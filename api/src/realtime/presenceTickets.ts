import { randomBytes } from "crypto";
import type { AuthUser } from "../middlewares/auth";

const PRESENCE_SOCKET_TICKET_TTL_MS = 30_000;

type PresenceSocketTicketRecord = {
  user: AuthUser;
  expiresAt: number;
};

const tickets = new Map<string, PresenceSocketTicketRecord>();

function cleanupExpiredTickets(now = Date.now()) {
  for (const [ticket, record] of tickets.entries()) {
    if (record.expiresAt <= now) {
      tickets.delete(ticket);
    }
  }
}

export function issuePresenceSocketTicket(user: AuthUser) {
  cleanupExpiredTickets();

  const ticket = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + PRESENCE_SOCKET_TICKET_TTL_MS;

  tickets.set(ticket, {
    user,
    expiresAt,
  });

  return {
    ticket,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export function consumePresenceSocketTicket(ticket: string) {
  cleanupExpiredTickets();

  const normalizedTicket = ticket.trim();
  if (!normalizedTicket) {
    return null;
  }

  const record = tickets.get(normalizedTicket);
  if (!record) {
    return null;
  }

  tickets.delete(normalizedTicket);

  if (record.expiresAt <= Date.now()) {
    return null;
  }

  return record.user;
}
