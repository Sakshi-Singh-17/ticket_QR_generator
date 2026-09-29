export interface CreateTicketPayload {
  eventId: string;
  attendeeName: string;
  attendeeContact: string;
  ticketType: 'GENERAL' | 'VIP' | 'STAFF' | 'PRESS';
  seatAllocation: string;
  notes?: string;
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; issue: string }>;
  };
  meta?: Record<string, unknown>;
}

export async function createTicket(payload: CreateTicketPayload): Promise<ApiResponse> {
  try {
    const res = await fetch('/api/v1/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    throw new Error(err?.message || 'Network Error: Fetch failed');
  }
}

export async function fetchTickets(params?: { query?: string; status?: string }): Promise<ApiResponse> {
  const queryParams = new URLSearchParams();
  if (params?.query) queryParams.set('query', params.query);
  if (params?.status) queryParams.set('status', params.status);

  const res = await fetch(`/api/v1/tickets?${queryParams.toString()}`);
  return res.json();
}

export async function fetchTicketById(id: string): Promise<ApiResponse> {
  const res = await fetch(`/api/v1/tickets/${encodeURIComponent(id)}`);
  return res.json();
}

export async function fetchQRCode(id: string): Promise<ApiResponse> {
  const res = await fetch(`/api/v1/tickets/${encodeURIComponent(id)}/qr`);
  return res.json();
}
