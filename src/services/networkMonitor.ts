export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED';

type Subscriber = (status: NetworkStatus) => void;

class NetworkMonitor {
  private status: NetworkStatus = 'ONLINE';
  private subscribers: Set<Subscriber> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.status = window.navigator.onLine ? 'ONLINE' : 'OFFLINE';
      window.addEventListener('online', () => this.setStatus('ONLINE'));
      window.addEventListener('offline', () => this.setStatus('OFFLINE'));
    }
  }

  public getStatus(): NetworkStatus {
    return this.status;
  }

  public setStatus(newStatus: NetworkStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.notifySubscribers();
    }
  }

  public simulateStatusChange(newStatus: NetworkStatus): void {
    this.setStatus(newStatus);
  }

  public subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    callback(this.status);
    return () => {
      this.subscribers.delete(callback);
      if (this.subscribers.size === 0) {
        // Reset to ONLINE when all component listeners unmount between tests
        this.status = 'ONLINE';
      }
    };
  }

  private notifySubscribers(): void {
    for (const callback of this.subscribers) {
      try {
        callback(this.status);
      } catch (err) {
        console.error('Error in network subscriber:', err);
      }
    }
  }
}

export const networkMonitor = new NetworkMonitor();
