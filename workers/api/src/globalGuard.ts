// Global quota guard: one Durable Object instance for the whole Worker.
//
// The per-IP CASE_STATUS_LIMITER is counted per Cloudflare location, so it
// cannot bound our total traffic to USCIS. Every live lookup asks this single
// object for a slot first, from every location, so the count is truly global.
//
// It sees no receipt, no IP, and no request body (API Invariant II): the
// Worker calls it with an empty GET and gets back { allowed }.
//
// A plain class with fetch() rather than a subclass of DurableObject from
// "cloudflare:workers": that module only exists inside workerd, and the Node
// test harness imports src/index.ts directly.

// USCIS production quota: 10 requests per second, 400,000 per day. We stop
// well short of both: USCIS's gateway enforces the per-second rate as a spike
// arrest (the sandbox smoothed 5/s to one per 200 ms), so a full-rate burst
// can trip it even under 10/s.
export const PER_SECOND_LIMIT = 5;
export const PER_DAY_LIMIT = 300_000;

// The day count is kept in memory and saved every FLUSH_EVERY slots, so a
// restart loses at most that many. Bounds storage writes to ~3,000 a day.
const FLUSH_EVERY = 100;
const DAY_KEY = 'day';

interface SavedDay {
  day: string;
  count: number;
}

// The slice of DurableObjectState this class uses, so tests can pass a fake.
export interface GuardState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
  };
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

export class GlobalQuotaGuard {
  private readonly state: GuardState;
  private second = 0;
  private secondCount = 0;
  private day = '';
  private dayCount = 0;

  constructor(state: GuardState, _env: unknown) {
    this.state = state;
    void state.blockConcurrencyWhile(async () => {
      const saved = await state.storage.get<SavedDay>(DAY_KEY);
      if (saved) {
        this.day = saved.day;
        this.dayCount = saved.count;
      }
    });
  }

  async fetch(): Promise<Response> {
    const allowed = this.tryAcquire(Date.now());
    if (allowed && this.dayCount % FLUSH_EVERY === 0) {
      await this.state.storage.put<SavedDay>(DAY_KEY, { day: this.day, count: this.dayCount });
    }
    return Response.json({ allowed });
  }

  /** Take one slot if both windows have room. UTC day, fixed 1 s window. */
  tryAcquire(now: number): boolean {
    const second = Math.floor(now / 1000);
    if (second !== this.second) {
      this.second = second;
      this.secondCount = 0;
    }
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.dayCount = 0;
    }
    if (this.secondCount >= PER_SECOND_LIMIT || this.dayCount >= PER_DAY_LIMIT) return false;
    this.secondCount++;
    this.dayCount++;
    return true;
  }
}
