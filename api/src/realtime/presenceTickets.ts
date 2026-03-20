import { randomBytes } from "crypto";
import type { AuthUser } from "../middlewares/auth";
import {
  isMatchingPresenceClientFingerprint,
  type PresenceClientFingerprint,
} from "./presenceClientFingerprint";

const PRESENCE_SOCKET_TICKET_TTL_MS = 30_000;

type PresenceSocketTicketRecord = {
  user: AuthUser;
  expiresAt: number;
  fingerprint: PresenceClientFingerprint;
};

const tickets = new Map<string, PresenceSocketTicketRecord>();

function cleanupExpiredTickets(now = Date.now()) {
  for (const [ticket, record] of tickets.entries()) {
    if (record.expiresAt <= now) {
      tickets.delete(ticket);
    }
  }
}

export function issuePresenceSocketTicket(user: AuthUser, fingerprint: PresenceClientFingerprint) {
  cleanupExpiredTickets();

  const ticket = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + PRESENCE_SOCKET_TICKET_TTL_MS;

  tickets.set(ticket, {
    user,
    expiresAt,
    fingerprint,
  });

  return {
    ticket,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export function consumePresenceSocketTicket(ticket: string, fingerprint: PresenceClientFingerprint) {
  cleanupExpiredTickets();

  const normalizedTicket = ticket.trim();
  if (!normalizedTicket) {
    return null;
  }

  const record = tickets.get(normalizedTicket);
  if (!record) {
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    tickets.delete(normalizedTicket);
    return null;
  }

  if (!isMatchingPresenceClientFingerprint(record.fingerprint, fingerprint)) {
    return null;
  }

  tickets.delete(normalizedTicket);

  return record.user;
}
