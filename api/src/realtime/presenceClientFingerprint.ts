import type { IncomingHttpHeaders } from "http";

export type PresenceClientFingerprint = {
  ip: string | null;
  userAgent: string | null;
};

type FingerprintSource = {
  headers: IncomingHttpHeaders;
  socket?: {
    remoteAddress?: string | null;
  };
};

type ForwardedPresenceClientFingerprint = Partial<PresenceClientFingerprint>;

function pickHeader(headers: IncomingHttpHeaders, name: string) {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeIp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const firstValue = value
    .split(",")[0]
    ?.trim()
    .replace(/^\[|\]$/g, "")
    .replace(/^::ffff:/i, "");

  if (!firstValue) {
    return null;
  }

  if (
    /^127\./.test(firstValue)
    || firstValue === "::1"
    || firstValue === "0.0.0.0"
    || firstValue.toLowerCase() === "localhost"
  ) {
    return "loopback";
  }

  return firstValue;
}

function normalizeUserAgent(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return normalized || null;
}

function isPrivateOrLoopbackIp(ip: string) {
  if (ip === "loopback") {
    return true;
  }

  if (/^10\./.test(ip)) {
    return true;
  }

  if (/^192\.168\./.test(ip)) {
    return true;
  }

  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) {
    return true;
  }

  if (/^169\.254\./.test(ip)) {
    return true;
  }

  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) {
    return true;
  }

  const normalized = ip.toLowerCase();
  return normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb");
}

export function extractPresenceClientFingerprint(
  source: FingerprintSource,
  forwarded?: ForwardedPresenceClientFingerprint
): PresenceClientFingerprint {
  const forwardedIp = normalizeIp(forwarded?.ip);
  const forwardedUserAgent = normalizeUserAgent(forwarded?.userAgent);
  const directIp =
    normalizeIp(pickHeader(source.headers, "x-forwarded-for"))
    ?? normalizeIp(pickHeader(source.headers, "x-real-ip"))
    ?? normalizeIp(source.socket?.remoteAddress ?? null);
  const directUserAgent = normalizeUserAgent(pickHeader(source.headers, "user-agent"));

  return {
    ip: forwardedIp ?? directIp,
    userAgent: forwardedUserAgent ?? directUserAgent,
  };
}

export function isMatchingPresenceClientFingerprint(
  expected: PresenceClientFingerprint,
  actual: PresenceClientFingerprint
) {
  if (
    expected.ip
    && actual.ip !== expected.ip
    && !(
      actual.ip
      && isPrivateOrLoopbackIp(expected.ip)
      && isPrivateOrLoopbackIp(actual.ip)
    )
  ) {
    return false;
  }

  if (expected.userAgent && actual.userAgent !== expected.userAgent) {
    return false;
  }

  return true;
}
