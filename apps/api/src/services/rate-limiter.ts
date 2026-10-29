import { TRPCError } from '@trpc/server';

/**
 * Configuration options for execution rate and concurrency limiting.
 */
export interface RateLimitConfig {
  /** Maximum number of `execution.run` requests permitted in the window. Default: 15. */
  runMax: number;
  /** Sliding window duration for `execution.run` in milliseconds. Default: 60,000 (1 min). */
  runWindowMs: number;
  /** Maximum number of `execution.submit` requests permitted in the window. Default: 5. */
  submitMax: number;
  /** Sliding window duration for `execution.submit` in milliseconds. Default: 60,000 (1 min). */
  submitWindowMs: number;
  /** Maximum concurrent executions allowed per client IP. Default: 1. */
  clientConcurrency: number;
  /** Maximum concurrent executions allowed across all clients on this process. Default: 4. */
  globalConcurrency: number;
  /** List of trusted reverse proxy IP addresses. Default: []. */
  trustedProxies: string[];
  /** Maximum number of client IP entries to track before LRU eviction. Default: 10,000. */
  maxTrackedClients: number;
  /** Interval in ms for sweeping expired entries. Default: 60,000. */
  sweepIntervalMs: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
  retryAfter?: number;
}

interface ClientState {
  runTimestamps: number[];
  submitTimestamps: number[];
  activeExecutions: number;
  lastActivity: number;
}

export function getDefaultRateLimitConfig(): RateLimitConfig {
  const parseNum = (val: string | undefined, defaultVal: number): number => {
    if (!val) return defaultVal;
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? n : defaultVal;
  };

  const trustedProxies = (process.env.TRUSTED_PROXIES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    runMax: parseNum(process.env.RATE_LIMIT_RUN_MAX, 15),
    runWindowMs: parseNum(process.env.RATE_LIMIT_RUN_WINDOW_MS, 60_000),
    submitMax: parseNum(process.env.RATE_LIMIT_SUBMIT_MAX, 5),
    submitWindowMs: parseNum(process.env.RATE_LIMIT_SUBMIT_WINDOW_MS, 60_000),
    clientConcurrency: parseNum(process.env.RATE_LIMIT_CLIENT_CONCURRENCY, 1),
    globalConcurrency: parseNum(process.env.RATE_LIMIT_GLOBAL_CONCURRENCY, 4),
    trustedProxies,
    maxTrackedClients: parseNum(process.env.RATE_LIMIT_MAX_CLIENTS, 10_000),
    sweepIntervalMs: parseNum(process.env.RATE_LIMIT_SWEEP_MS, 60_000),
  };
}

/**
 * Normalizes IP addresses (e.g., stripping IPv6 mapped IPv4 prefix `::ffff:`).
 */
export function normalizeIp(ip: string | undefined | null): string {
  if (!ip) return '127.0.0.1';
  let clean = ip.trim();
  if (clean.startsWith('::ffff:')) {
    clean = clean.slice(7);
  }
  return clean;
}

/**
 * Extracts and securely verifies the client IP address.
 *
 * SECURITY:
 * Never trusts arbitrary X-Forwarded-For or X-Real-IP headers unless the direct
 * remote socket address matches an entry in `trustedProxies`.
 */
export function resolveClientIp(
  req: Request,
  directSocketIp: string | undefined | null,
  trustedProxies: string[] = []
): string {
  const normalizedSocket = normalizeIp(directSocketIp);

  // If socket IP is undefined or empty, fallback to direct
  if (!directSocketIp) {
    return 'direct';
  }

  // Check if direct connection originates from a configured trusted proxy
  const isTrusted = trustedProxies.some(
    (trusted) => normalizeIp(trusted) === normalizedSocket
  );

  if (isTrusted) {
    // Only inspect forwarding headers if the upstream connection is trusted
    const xff = req.headers.get('x-forwarded-for');
    if (xff) {
      // Standard: client, proxy1, proxy2... Leftmost is the originating client
      const clientCandidate = xff.split(',')[0]?.trim();
      if (clientCandidate) {
        return normalizeIp(clientCandidate);
      }
    }

    const xRealIp = req.headers.get('x-real-ip');
    if (xRealIp && xRealIp.trim()) {
      return normalizeIp(xRealIp.trim());
    }
  }

  // When not behind a trusted proxy, strictly use the socket remote address
  return normalizedSocket;
}

/**
 * In-memory execution rate and concurrency limiter.
 *
 * NOTE ON MULTI-INSTANCE DEPLOYMENTS:
 * This rate limiter maintains in-memory sliding windows and active concurrency counters
 * local to this Node.js process. In multi-instance or horizontally scaled deployments,
 * each instance manages its own limits independently. A distributed backing store
 * (e.g., Redis) is required to enforce coordinated global limits across multiple instances.
 */
export class ExecutionRateLimiter {
  private readonly config: RateLimitConfig;
  private readonly clients = new Map<string, ClientState>();
  private globalActiveCount = 0;
  private sweepTimer?: NodeJS.Timeout;
  private readonly now: () => number;

  constructor(config?: Partial<RateLimitConfig>, nowFn?: () => number) {
    this.config = { ...getDefaultRateLimitConfig(), ...config };
    this.now = nowFn ?? (() => Date.now());

    // Periodic sweep for expired timestamps to bound memory
    if (this.config.sweepIntervalMs > 0 && typeof setInterval !== 'undefined') {
      this.sweepTimer = setInterval(() => this.sweepExpired(), this.config.sweepIntervalMs);
      if (this.sweepTimer && typeof this.sweepTimer.unref === 'function') {
        this.sweepTimer.unref();
      }
    }
  }

  private getOrCreateClient(clientIp: string): ClientState {
    let state = this.clients.get(clientIp);
    if (!state) {
      // Enforce max tracked clients with LRU eviction to prevent memory exhaustion
      if (this.clients.size >= this.config.maxTrackedClients) {
        this.evictOldestClient();
      }

      state = {
        runTimestamps: [],
        submitTimestamps: [],
        activeExecutions: 0,
        lastActivity: this.now(),
      };
      this.clients.set(clientIp, state);
    } else {
      state.lastActivity = this.now();
    }
    return state;
  }

  private evictOldestClient(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [ip, state] of this.clients.entries()) {
      // Do not evict clients currently executing
      if (state.activeExecutions === 0 && state.lastActivity < oldestTime) {
        oldestTime = state.lastActivity;
        oldestKey = ip;
      }
    }

    if (oldestKey) {
      this.clients.delete(oldestKey);
    }
  }

  private sweepExpired(): void {
    const now = this.now();
    const maxWindow = Math.max(this.config.runWindowMs, this.config.submitWindowMs);

    for (const [ip, state] of this.clients.entries()) {
      // Filter out timestamps outside their respective windows
      state.runTimestamps = state.runTimestamps.filter((t) => now - t < this.config.runWindowMs);
      state.submitTimestamps = state.submitTimestamps.filter((t) => now - t < this.config.submitWindowMs);

      // Remove client entirely if idle and no recent executions
      if (
        state.activeExecutions === 0 &&
        state.runTimestamps.length === 0 &&
        state.submitTimestamps.length === 0 &&
        now - state.lastActivity > maxWindow
      ) {
        this.clients.delete(ip);
      }
    }
  }

  /**
   * Checks rate limit for a client and action ('run' | 'submit').
   * Throws a tRPC TOO_MANY_REQUESTS error if rate limit is exceeded.
   */
  public checkRateLimit(clientIp: string, action: 'run' | 'submit'): RateLimitCheckResult {
    const now = this.now();
    const state = this.getOrCreateClient(clientIp);

    const isRun = action === 'run';
    const limit = isRun ? this.config.runMax : this.config.submitMax;
    const windowMs = isRun ? this.config.runWindowMs : this.config.submitWindowMs;
    const timestamps = isRun ? state.runTimestamps : state.submitTimestamps;

    // Filter out timestamps outside the sliding window
    const recent = timestamps.filter((t) => now - t < windowMs);
    if (isRun) {
      state.runTimestamps = recent;
    } else {
      state.submitTimestamps = recent;
    }

    if (recent.length >= limit) {
      const oldestInWindow = recent[0] ?? now;
      const msUntilReset = Math.max(1, oldestInWindow + windowMs - now);
      const retryAfter = Math.ceil(msUntilReset / 1000);
      const resetAt = new Date(now + msUntilReset).toISOString();

      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded for ${action}. You can make at most ${limit} request${
          limit === 1 ? '' : 's'
        } per ${Math.round(windowMs / 1000)}s. Please try again in ${retryAfter} second${
          retryAfter === 1 ? '' : 's'
        }.`,
        cause: {
          retryAfter,
          resetAt,
          limit,
          remaining: 0,
        },
      });
    }

    // Allowed: record this request timestamp
    recent.push(now);
    state.lastActivity = now;

    const remaining = limit - recent.length;
    const oldestInWindow = recent[0] ?? now;
    const msUntilReset = Math.max(1, oldestInWindow + windowMs - now);
    const resetAt = new Date(now + msUntilReset).toISOString();

    return {
      allowed: true,
      limit,
      remaining,
      resetAt,
    };
  }

  /**
   * Acquires a concurrency execution slot for a client.
   * Throws TOO_MANY_REQUESTS if per-client or global concurrency limit is exceeded.
   * Returns a release callback that MUST be called when execution finishes.
   */
  public acquireConcurrencySlot(clientIp: string): () => void {
    const state = this.getOrCreateClient(clientIp);

    if (state.activeExecutions >= this.config.clientConcurrency) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message:
          'An execution is already in progress for this client. Please wait for it to complete.',
        cause: {
          retryAfter: 2,
          limit: this.config.clientConcurrency,
          remaining: 0,
        },
      });
    }

    if (this.globalActiveCount >= this.config.globalConcurrency) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message:
          'Execution capacity reached on this server instance. Please try again in a few moments.',
        cause: {
          retryAfter: 3,
          limit: this.config.globalConcurrency,
          remaining: 0,
        },
      });
    }

    // Increment active slot counters
    state.activeExecutions++;
    this.globalActiveCount++;
    state.lastActivity = this.now();

    let released = false;
    return () => {
      if (released) return; // Idempotent release
      released = true;
      state.activeExecutions = Math.max(0, state.activeExecutions - 1);
      this.globalActiveCount = Math.max(0, this.globalActiveCount - 1);
      state.lastActivity = this.now();
    };
  }

  /**
   * Resets all internal tracking state. Useful for test isolation.
   */
  public reset(): void {
    this.clients.clear();
    this.globalActiveCount = 0;
  }

  /**
   * Destroys sweep timer.
   */
  public destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  /**
   * Current stats for observability/debugging.
   */
  public getStats(): {
    activeGlobal: number;
    trackedClients: number;
    config: RateLimitConfig;
  } {
    return {
      activeGlobal: this.globalActiveCount,
      trackedClients: this.clients.size,
      config: { ...this.config },
    };
  }
}

// Singleton limiter for runtime usage across requests
let globalLimiter: ExecutionRateLimiter | null = null;

export function getExecutionRateLimiter(): ExecutionRateLimiter {
  if (!globalLimiter) {
    globalLimiter = new ExecutionRateLimiter();
  }
  return globalLimiter;
}

export function setExecutionRateLimiter(limiter: ExecutionRateLimiter | null): void {
  if (globalLimiter && globalLimiter !== limiter) {
    globalLimiter.destroy();
  }
  globalLimiter = limiter;
}
