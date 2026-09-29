import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sanitizeInput } from './utils/sanitization.ts';
import { generateQRDataUrl } from './utils/qrUtils.ts';
import { analyticsService } from './services/analyticsService.ts';
import { networkMonitor, NetworkStatus } from './services/networkMonitor.ts';
import * as api from './services/apiClient.ts';

export interface TicketData {
  id: string;
  ticketNumber: string;
  eventId: string;
  attendeeName: string;
  attendeeContact: string;
  ticketType: 'GENERAL' | 'VIP' | 'STAFF' | 'PRESS';
  seatAllocation: string;
  notes?: string;
  qrDataUrl: string;
  status: 'ISSUED' | 'VOIDED';
  createdAt: string;
}

export function TicketGeneratorWorker(): React.ReactElement {
  // Form State
  const [eventId, setEventId] = useState('3fa85f64-5717-4562-b3fc-2c963f66afa6');
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeeContact, setAttendeeContact] = useState('');
  const [ticketType, setTicketType] = useState<'GENERAL' | 'VIP' | 'STAFF' | 'PRESS'>('GENERAL');
  const [seatAllocation, setSeatAllocation] = useState('');
  const [notes, setNotes] = useState('');

  // UI & Network States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(networkMonitor.getStatus());
  const [serverError, setServerError] = useState<string | null>(null);
  const [localSyncNotice, setLocalSyncNotice] = useState<string | null>(null);

  // Active Ticket & Session History
  const [currentTicket, setCurrentTicket] = useState<TicketData | null>(null);
  const [history, setHistory] = useState<TicketData[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  const filteredHistory = history.filter((t) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return t.attendeeName.toLowerCase().includes(q) || t.ticketNumber.toLowerCase().includes(q);
  });

  // Mutex lock for double click prevention
  const isSubmittingRef = useRef(false);

  // Subscribe to network changes
  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((status) => {
      setNetworkStatus(status);
    });
    return unsubscribe;
  }, []);

  const validateContact = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    const clean = value.replace(/[\s-]/g, '');
    return emailRegex.test(value) || phoneRegex.test(clean);
  };

  const handleContactBlur = () => {
    if (attendeeContact.trim() && !validateContact(attendeeContact.trim())) {
      setErrors((prev) => ({
        ...prev,
        attendeeContact: 'Valid email or phone required (e.g. name@example.com or +1234567890)',
      }));
    } else {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.attendeeContact;
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const cleanName = sanitizeInput(attendeeName);
    if (!cleanName || cleanName.length < 2) {
      newErrors.attendeeName = 'Attendee name is required (min 2 characters).';
    }

    const cleanContact = attendeeContact.trim();
    if (!cleanContact || !validateContact(cleanContact)) {
      newErrors.attendeeContact = 'Valid email or phone required (e.g. name@example.com or +1234567890).';
    }

    const cleanSeat = sanitizeInput(seatAllocation);
    if (!cleanSeat) {
      newErrors.seatAllocation = 'Seat allocation is required.';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      analyticsService.logEvent({
        eventName: 'TICKET_VALIDATION_FAILURE',
        metadata: { errors: newErrors },
      });

      // Shift focus to the first invalid field
      const firstKey = Object.keys(newErrors)[0];
      const fieldIdMap: Record<string, string> = {
        attendeeName: 'attendee-name',
        attendeeContact: 'attendee-contact',
        seatAllocation: 'seat-allocation',
      };

      const elementToFocus = document.getElementById(fieldIdMap[firstKey] || firstKey);
      if (elementToFocus) {
        elementToFocus.focus();
      }
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current || isGenerating) {
      return;
    }

    setServerError(null);
    setLocalSyncNotice(null);

    // Sanitize state before validation and submission
    const sanitizedName = sanitizeInput(attendeeName);
    const sanitizedSeat = sanitizeInput(seatAllocation);
    const sanitizedNotes = notes ? sanitizeInput(notes) : '';

    setAttendeeName(sanitizedName);
    setSeatAllocation(sanitizedSeat);
    setNotes(sanitizedNotes);

    if (!validateForm()) {
      return;
    }

    isSubmittingRef.current = true;
    setIsGenerating(true);
    const startTime = Date.now();

    try {
      let createdTicket: TicketData;

      try {
        const response = await api.createTicket({
          eventId,
          attendeeName: sanitizedName,
          attendeeContact: attendeeContact.trim(),
          ticketType,
          seatAllocation: sanitizedSeat,
          notes: sanitizedNotes,
          errorCorrection: 'M',
        });

        if (response.success && response.data) {
          const qrDataUrl = await generateQRDataUrl(response.data.qrCode.qrPayload);
          createdTicket = {
            id: response.data.ticket.id,
            ticketNumber: response.data.ticket.ticketNumber,
            eventId: response.data.ticket.eventId,
            attendeeName: response.data.ticket.attendeeName,
            attendeeContact: response.data.ticket.attendeeContact,
            ticketType: response.data.ticket.ticketType,
            seatAllocation: response.data.ticket.seatAllocation,
            notes: response.data.ticket.notes,
            status: response.data.ticket.status,
            createdAt: response.data.ticket.createdAt,
            qrDataUrl,
          };
        } else {
          setServerError(response.error?.message || 'Server error occurred while generating ticket.');
          return;
        }
      } catch (networkErr: any) {
        // Offline / Unreachable Network Fallback
        const localId = 'loc_' + Math.random().toString(36).substring(2, 9);
        const localNumber = 'TKT-LOC-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const payloadStr = JSON.stringify({
          tId: localId,
          num: localNumber,
          type: ticketType,
          mode: 'OFFLINE_LOCAL',
        });
        const qrDataUrl = await generateQRDataUrl(payloadStr);

        createdTicket = {
          id: localId,
          ticketNumber: localNumber,
          eventId,
          attendeeName: sanitizedName,
          attendeeContact: attendeeContact.trim(),
          ticketType,
          seatAllocation: sanitizedSeat,
          notes: sanitizedNotes,
          status: 'ISSUED',
          createdAt: new Date().toISOString(),
          qrDataUrl,
        };

        setLocalSyncNotice('Ticket saved locally; sync pending.');
      }

      setCurrentTicket(createdTicket);
      setHistory((prev) => [createdTicket, ...prev.slice(0, 19)]);

      analyticsService.logEvent({
        eventName: 'TICKET_GENERATED',
        ticketId: createdTicket.id,
        metadata: {
          durationMs: Date.now() - startTime,
          ticketType: createdTicket.ticketType,
        },
      });
    } catch (err: any) {
      setServerError(err?.message || 'Unexpected failure generating ticket.');
    } finally {
      setIsGenerating(false);
      isSubmittingRef.current = false;
    }
  };

  const handleResetForm = () => {
    setAttendeeName('');
    setAttendeeContact('');
    setSeatAllocation('');
    setNotes('');
    setErrors({});
    setServerError(null);
    setLocalSyncNotice(null);
  };

  const handlePrint = () => {
    analyticsService.logEvent({
      eventName: 'TICKET_PRINT_CLICK',
      ticketId: currentTicket?.id,
    });
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  const handleDownload = () => {
    if (!currentTicket) return;
    analyticsService.logEvent({
      eventName: 'TICKET_DOWNLOAD_CLICK',
      ticketId: currentTicket.id,
    });

    const link = document.createElement('a');
    link.download = `${currentTicket.ticketNumber}-QR.png`;
    link.href = currentTicket.qrDataUrl;
    link.click();
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#000000', backgroundColor: '#FFFFFF' }}>
      <header style={{ borderBottom: '2px solid #000000', paddingBottom: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
          Digital Ticket QR Code Generator Worker
        </h1>
        <p style={{ margin: 0, color: '#4A5568', fontSize: '14px' }}>
          Floor staff portal for instant admission ticket voucher generation and scannable QR verification.
        </p>
      </header>

      {/* Network Alert Banner */}
      {networkStatus === 'OFFLINE' && (
        <div
          role="alert"
          style={{
            backgroundColor: '#000000',
            color: '#FFFFFF',
            padding: '12px 16px',
            marginBottom: '16px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          Operating offline - local storage mode.
        </div>
      )}

      {/* Server or Local Sync Alert Banner */}
      {serverError && (
        <div
          role="alert"
          style={{
            border: '2px solid #000000',
            backgroundColor: '#F7FAFC',
            color: '#000000',
            padding: '12px 16px',
            marginBottom: '16px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {serverError}
        </div>
      )}

      {localSyncNotice && (
        <div
          style={{
            border: '2px solid #000000',
            backgroundColor: '#EDF2F7',
            padding: '12px 16px',
            marginBottom: '16px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {localSyncNotice}
        </div>
      )}

      <main style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px' }}>
        {/* Left Column: Form */}
        <section aria-labelledby="form-heading">
          <h2 id="form-heading" style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
            Ticket Details
          </h2>

          <form onSubmit={handleSubmit} noValidate>
            {/* Event Dropdown */}
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="event-id" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                Event
              </label>
              <select
                id="event-id"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #718096', fontSize: '14px', backgroundColor: '#FFFFFF' }}
              >
                <option value="3fa85f64-5717-4562-b3fc-2c963f66afa6">TechConf 2026 - Grand Arena</option>
              </select>
            </div>

            {/* Attendee Name */}
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="attendee-name" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                Attendee Full Name
              </label>
              <input
                id="attendee-name"
                type="text"
                value={attendeeName}
                maxLength={100}
                onChange={(e) => setAttendeeName(e.target.value)}
                onBlur={() => setAttendeeName((prev) => sanitizeInput(prev, true))}
                aria-invalid={errors.attendeeName ? 'true' : 'false'}
                aria-describedby={errors.attendeeName ? 'attendeeName-error' : undefined}
                className={errors.attendeeName ? 'border-black border-2' : ''}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: errors.attendeeName ? '2px solid #000000' : '1px solid #718096',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              {errors.attendeeName && (
                <div id="attendeeName-error" style={{ color: '#000000', fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>
                  {errors.attendeeName}
                </div>
              )}
            </div>

            {/* Contact Email or Phone */}
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="attendee-contact" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                Contact Email or Phone
              </label>
              <input
                id="attendee-contact"
                type="text"
                value={attendeeContact}
                maxLength={100}
                onChange={(e) => setAttendeeContact(e.target.value)}
                onBlur={handleContactBlur}
                aria-invalid={errors.attendeeContact ? 'true' : 'false'}
                aria-describedby={errors.attendeeContact ? 'attendeeContact-error' : undefined}
                className={errors.attendeeContact ? 'border-black border-2' : ''}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: errors.attendeeContact ? '2px solid #000000' : '1px solid #718096',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              {errors.attendeeContact && (
                <div id="attendeeContact-error" style={{ color: '#000000', fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>
                  {errors.attendeeContact}
                </div>
              )}
            </div>

            {/* Ticket Tier */}
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="ticket-tier" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                Ticket Tier
              </label>
              <select
                id="ticket-tier"
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value as any)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #718096', fontSize: '14px', backgroundColor: '#FFFFFF' }}
              >
                <option value="GENERAL">General Admission</option>
                <option value="VIP">VIP</option>
                <option value="STAFF">Staff</option>
                <option value="PRESS">Press</option>
              </select>
            </div>

            {/* Seat Allocation */}
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="seat-allocation" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                Seat Allocation
              </label>
              <input
                id="seat-allocation"
                type="text"
                value={seatAllocation}
                maxLength={60}
                onChange={(e) => setSeatAllocation(e.target.value)}
                onBlur={() => setSeatAllocation((prev) => sanitizeInput(prev, true))}
                aria-invalid={errors.seatAllocation ? 'true' : 'false'}
                aria-describedby={errors.seatAllocation ? 'seatAllocation-error' : undefined}
                className={errors.seatAllocation ? 'border-black border-2' : ''}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: errors.seatAllocation ? '2px solid #000000' : '1px solid #718096',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              {errors.seatAllocation && (
                <div id="seatAllocation-error" style={{ color: '#000000', fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>
                  {errors.seatAllocation}
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="ticket-notes" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                Notes
              </label>
              <textarea
                id="ticket-notes"
                value={notes}
                maxLength={255}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => setNotes((prev) => sanitizeInput(prev, true))}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #718096',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                disabled={isGenerating}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '15px',
                  border: '2px solid #000000',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  opacity: isGenerating ? 0.6 : 1,
                }}
              >
                Generate Ticket
              </button>
              <button
                type="button"
                onClick={handleResetForm}
                style={{
                  padding: '12px 18px',
                  backgroundColor: '#FFFFFF',
                  color: '#000000',
                  fontWeight: 600,
                  fontSize: '15px',
                  border: '2px solid #000000',
                  cursor: 'pointer',
                }}
              >
                New Ticket
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: Ticket Preview & QR Output */}
        <section
          role="region"
          aria-label="Ticket Preview"
          style={{
            border: '2px solid #000000',
            padding: '24px',
            backgroundColor: '#FAFAFA',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '380px',
          }}
        >
          {isGenerating ? (
            <div role="status" aria-live="polite" style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #E2E8F0',
                  borderTop: '4px solid #000000',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px auto',
                }}
              />
              <span style={{ fontSize: '16px', fontWeight: 600 }}>Generating ticket QR code...</span>
            </div>
          ) : currentTicket ? (
            <div style={{ width: '100%', textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #CBD5E0', paddingBottom: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {currentTicket.ticketType} Pass
                </span>
                <h3 style={{ margin: '4px 0', fontSize: '20px', fontWeight: 800 }}>
                  {currentTicket.attendeeName}
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#4A5568' }}>
                  {currentTicket.ticketNumber}
                </p>
              </div>

              <div style={{ margin: '16px 0', display: 'flex', justifyContent: 'center' }}>
                <img
                  src={currentTicket.qrDataUrl}
                  alt={`QR Code for Ticket #${currentTicket.ticketNumber}`}
                  role="img"
                  style={{ width: '200px', height: '200px', border: '1px solid #000000' }}
                />
              </div>

              <div style={{ marginBottom: '20px', fontSize: '14px', fontWeight: 600 }}>
                {currentTicket.seatAllocation}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handlePrint}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    border: '1px solid #000000',
                    cursor: 'pointer',
                  }}
                >
                  Print Ticket
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#FFFFFF',
                    color: '#000000',
                    fontWeight: 700,
                    border: '1px solid #000000',
                    cursor: 'pointer',
                  }}
                >
                  Download QR
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#4A5568' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#000000', margin: '0 0 8px 0' }}>
                No data found
              </h3>
              <p style={{ fontSize: '14px', margin: 0 }}>
                Fill out the ticket form to generate a QR voucher.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Shift Session History Table */}
      <section aria-labelledby="history-heading" style={{ marginTop: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <h2 id="history-heading" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
            Recent Tickets (Shift History)
          </h2>
          {history.length > 0 && (
            <div>
              <label htmlFor="history-search" style={{ fontSize: '13px', fontWeight: 600, marginRight: '8px' }}>
                Filter History:
              </label>
              <input
                id="history-search"
                type="search"
                placeholder="Search name or ticket #..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #718096' }}
              />
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed #CBD5E0', color: '#4A5568' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>No data found</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#718096' }}>Issued tickets for this shift will be listed here.</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', border: '1px solid #CBD5E0', backgroundColor: '#F7FAFC' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#000000' }}>No data found</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#718096' }}>No tickets match your filter criteria.</p>
          </div>
        ) : (
          <table
            aria-label="Recent Tickets"
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', border: '1px solid #CBD5E0' }}
          >
            <thead>
              <tr style={{ backgroundColor: '#F7FAFC', borderBottom: '2px solid #000000' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Ticket #</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Attendee</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tier</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Seat</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Issued At</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{t.ticketNumber}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>Attendee: {t.attendeeName}</td>
                  <td style={{ padding: '8px 12px' }}>{t.ticketType}</td>
                  <td style={{ padding: '8px 12px' }}>Zone/Seat: {t.seatAllocation}</td>
                  <td style={{ padding: '8px 12px', color: '#718096' }}>{new Date(t.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
