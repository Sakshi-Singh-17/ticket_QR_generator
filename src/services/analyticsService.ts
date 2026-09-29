import crypto from 'node:crypto';

export interface AnalyticsEvent {
  eventId: string;
  eventName: string;
  metadata: Record<string, unknown>;
  timestamp: number;
  ticketId?: string | null;
}

const MAX_QUEUE_SIZE = 50;
let eventQueue: AnalyticsEvent[] = [];
const generateUUID = (): string => {
  return globalThis.crypto.randomUUID();
};


export const analyticsService = {
  logEvent(input: {
    eventName: string;
    metadata?: Record<string, unknown>;
    ticketId?: string | null;
  }): AnalyticsEvent {
    const event: AnalyticsEvent = {
      eventId: generateUUID(),
      eventName: input.eventName,
      metadata: input.metadata || {},
      timestamp: Date.now(),
      ticketId: input.ticketId || null,
    };

    eventQueue.push(event);

    if (eventQueue.length > MAX_QUEUE_SIZE) {
      eventQueue.shift();
    }

    return event;
  },

  getQueue(): AnalyticsEvent[] {
    return [...eventQueue];
  },

  clearQueue(): void {
    eventQueue = [];
  },

  flush(): AnalyticsEvent[] {
    const flushed = [...eventQueue];
    eventQueue = [];
    return flushed;
  },
};
