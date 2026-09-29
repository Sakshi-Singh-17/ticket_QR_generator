import http from 'http';
import crypto from 'node:crypto';
import { sanitizeInput } from './utils/sanitization.ts';

export interface Ticket {
  id: string;
  ticketNumber: string;
  eventId: string;
  attendeeName: string;
  attendeeContact: string;
  ticketType: 'GENERAL' | 'VIP' | 'STAFF' | 'PRESS';
  seatAllocation: string;
  notes?: string;
  status: 'ISSUED' | 'VOIDED' | 'USED' | 'EXPIRED';
  issuedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketQRCode {
  id: string;
  ticketId: string;
  qrPayload: string;
  verificationHash: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  scanCount: number;
  lastScannedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// In-Memory Database Store conforming to approved schema
export const db = {
  tickets: new Map<string, Ticket>(),
  qrCodes: new Map<string, TicketQRCode>(),
  analyticsLogs: [] as any[],
  events: [
    {
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      eventCode: 'TECHCONF-2026',
      name: 'Global Tech Summit 2026',
      venue: 'Grand Arena - Gate 4',
      eventDate: '2026-10-15T09:00:00.000Z',
      status: 'ACTIVE',
    },
  ],
};

function generateUUID(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateTicketNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TKT-${dateStr}-${rand}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(phone.replace(/[\s-]/g, ''));
}

export const app = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

  // Helper to send JSON responses
  const sendJSON = (statusCode: number, data: any) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
    });
    res.end(JSON.stringify(data));
  };

  // Helper to read request body
  const readBody = (): Promise<any> => {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
    });
  };

  // Route: GET /api/v1/events/active
  if (method === 'GET' && pathname === '/api/v1/events/active') {
    return sendJSON(200, {
      success: true,
      data: db.events.filter((e) => e.status === 'ACTIVE'),
      meta: { timestamp: new Date().toISOString() },
    });
  }

  // Route: POST /api/v1/tickets (Create Ticket + QR Atomic Generation)
  if (method === 'POST' && pathname === '/api/v1/tickets') {
    const body = await readBody();
    const errors: Array<{ field: string; issue: string }> = [];

    // Field Validations
    if (!body.eventId || typeof body.eventId !== 'string') {
      errors.push({ field: 'eventId', issue: 'Valid eventId is required' });
    }

    const attendeeName = sanitizeInput(body.attendeeName || '');
    if (!attendeeName || attendeeName.length < 2 || attendeeName.length > 100) {
      errors.push({ field: 'attendeeName', issue: 'Attendee name is required (2-100 characters)' });
    }

    const attendeeContact = (body.attendeeContact || '').trim();
    if (!attendeeContact || (!isValidEmail(attendeeContact) && !isValidPhone(attendeeContact))) {
      errors.push({ field: 'attendeeContact', issue: 'Must be a valid email or phone number' });
    }

    const validTiers = ['GENERAL', 'VIP', 'STAFF', 'PRESS'];
    if (!body.ticketType || !validTiers.includes(body.ticketType)) {
      errors.push({ field: 'ticketType', issue: `Ticket tier must be one of: ${validTiers.join(', ')}` });
    }

    const seatAllocation = sanitizeInput(body.seatAllocation || '');
    if (!seatAllocation || seatAllocation.length < 1 || seatAllocation.length > 60) {
      errors.push({ field: 'seatAllocation', issue: 'Seat allocation is required (1-60 characters)' });
    }

    if (errors.length > 0) {
      return sendJSON(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request payload failed validation.',
          details: errors,
        },
      });
    }

    const ticketId = generateUUID();
    const qrId = generateUUID();
    const ticketNumber = generateTicketNumber();
    const now = new Date().toISOString();
    const notes = body.notes ? sanitizeInput(body.notes) : undefined;
    const errorCorrection = (body.errorCorrection || 'M').toUpperCase();

    // Construct verifiable QR payload
    const qrPayloadObj = {
      tId: ticketId,
      num: ticketNumber,
      type: body.ticketType,
      ts: Date.now(),
    };

    // Calculate SHA-256 verification hash
    const verificationHash = crypto
      .createHmac('sha256', 'SECRET_WORKER_KEY')
      .update(JSON.stringify(qrPayloadObj))
      .digest('hex');

    const qrPayloadWithSig = JSON.stringify({
      ...qrPayloadObj,
      sig: verificationHash.substring(0, 16),
    });

    const ticket: Ticket = {
      id: ticketId,
      ticketNumber,
      eventId: body.eventId,
      attendeeName,
      attendeeContact,
      ticketType: body.ticketType,
      seatAllocation,
      notes,
      status: 'ISSUED',
      issuedBy: body.issuedBy || 'FLOOR_WORKER',
      createdAt: now,
      updatedAt: now,
    };

    const qrCode: TicketQRCode = {
      id: qrId,
      ticketId,
      qrPayload: qrPayloadWithSig,
      verificationHash,
      errorCorrection: errorCorrection as any,
      scanCount: 0,
      lastScannedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    // Store in DB
    db.tickets.set(ticketId, ticket);
    db.qrCodes.set(ticketId, qrCode);

    return sendJSON(201, {
      success: true,
      data: {
        ticket,
        qrCode,
      },
      meta: {
        timestamp: now,
      },
    });
  }

  // Route: GET /api/v1/tickets (List / Search)
  if (method === 'GET' && pathname === '/api/v1/tickets') {
    const query = (url.searchParams.get('query') || '').trim().toLowerCase();
    const status = url.searchParams.get('status');

    let results = Array.from(db.tickets.values());

    if (query) {
      results = results.filter(
        (t) =>
          t.attendeeName.toLowerCase().includes(query) ||
          t.ticketNumber.toLowerCase().includes(query)
      );
    }

    if (status) {
      results = results.filter((t) => t.status === status);
    }

    return sendJSON(200, {
      success: true,
      data: results,
      meta: {
        pagination: {
          totalRecords: results.length,
          currentPage: 1,
          limit: 20,
        },
      },
    });
  }

  // Route: GET /api/v1/tickets/:id/qr
  const qrMatch = pathname.match(/^\/api\/v1\/tickets\/([0-9a-f-]+)\/qr$/i);
  if (method === 'GET' && qrMatch) {
    const ticketId = qrMatch[1];
    const qrCode = db.qrCodes.get(ticketId);

    if (!qrCode) {
      return sendJSON(404, {
        success: false,
        error: {
          code: 'TICKET_NOT_FOUND',
          message: 'No QR code found for the specified ticket ID.',
        },
      });
    }

    return sendJSON(200, {
      success: true,
      data: {
        ticketId,
        qrPayload: qrCode.qrPayload,
        verificationHash: qrCode.verificationHash,
        errorCorrection: qrCode.errorCorrection,
        scanCount: qrCode.scanCount,
        lastScannedAt: qrCode.lastScannedAt,
        monochromeConfig: {
          dark: '#000000',
          light: '#FFFFFF',
          margin: 2,
        },
      },
    });
  }

  // Route: GET /api/v1/tickets/:id
  const ticketMatch = pathname.match(/^\/api\/v1\/tickets\/([0-9a-f-]+)$/i);
  if (method === 'GET' && ticketMatch) {
    const ticketId = ticketMatch[1];
    const ticket = db.tickets.get(ticketId);

    if (!ticket) {
      return sendJSON(404, {
        success: false,
        error: {
          code: 'TICKET_NOT_FOUND',
          message: 'No ticket found for the specified ticket ID.',
        },
      });
    }

    const qrCode = db.qrCodes.get(ticketId);
    return sendJSON(200, {
      success: true,
      data: {
        ticket,
        qrCode,
      },
    });
  }

  // Route: POST /api/v1/analytics/events
  if (method === 'POST' && pathname === '/api/v1/analytics/events') {
    const body = await readBody();
    const events = body.events || [];

    for (const evt of events) {
      db.analyticsLogs.push({
        id: generateUUID(),
        sessionId: body.sessionId || 'anonymous',
        ...evt,
        createdAt: new Date().toISOString(),
      });
    }

    return sendJSON(202, {
      success: true,
      data: {
        ingestedCount: events.length,
      },
    });
  }

  // Fallback 404
  return sendJSON(404, {
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested route was not found.',
    },
  });
});


app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});