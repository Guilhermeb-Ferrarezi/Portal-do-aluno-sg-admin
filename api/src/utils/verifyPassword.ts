import bcrypt from "bcrypt";
import crypto from "crypto";

type PasswordVerificationResult = {
  ok: boolean;
  needsRehash: boolean;
};

function sha256Base64(value: string) {
  return crypto.createHash("sha256").update(value).digest("base64");
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeBcryptHash(storedHash: string) {
  return storedHash.trim().replace(/^\$\$2([aby])\$\$/i, "$2$1$");
}

export async function verifyPassword(inputPassword: string, storedHash: string) {
  const normalizedBcrypt = normalizeBcryptHash(storedHash);

  if (
    normalizedBcrypt.startsWith("$2a$") ||
    normalizedBcrypt.startsWith("$2b$") ||
    normalizedBcrypt.startsWith("$2y$")
  ) {
    return bcrypt.compare(inputPassword, normalizedBcrypt);
  }

  return false;
}

export async function verifyPasswordForLoginMigration(
  inputPassword: string,
  storedHash: string
): Promise<PasswordVerificationResult> {
  const normalized = storedHash.trim();
  const ok = await verifyPassword(inputPassword, normalized);
  if (ok) {
    return { ok: true, needsRehash: false };
  }

  const matchesBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(normalized);
  if (matchesBase64 && normalized.length >= 43) {
    return {
      ok: sha256Base64(inputPassword) === normalized,
      needsRehash: true,
    };
  }

  if (/^[A-Fa-f0-9]{64}$/.test(normalized)) {
    return {
      ok: sha256Hex(inputPassword) === normalized.toLowerCase(),
      needsRehash: true,
    };
  }

  return { ok: false, needsRehash: false };
}
