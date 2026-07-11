import { Role, type Session } from "@/auth/types";

export class SessionManager {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly ttlMs: number) {}

  create(userId: number, role: Role): Session {
    this.cleanup();

    const now = Date.now();
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      role,
      createdAt: now,
      expiresAt: now + this.ttlMs,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return session;
  }

  refresh(sessionId: string): Session | undefined {
    const session = this.get(sessionId);
    if (!session) return undefined;
    session.expiresAt = Date.now() + this.ttlMs;
    return session;
  }

  invalidate(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  invalidateByUser(userId: number): void {
    for (const [id, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(id);
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
      }
    }
  }

  get activeSessions(): number {
    this.cleanup();
    return this.sessions.size;
  }
}
