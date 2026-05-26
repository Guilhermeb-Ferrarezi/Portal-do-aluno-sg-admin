import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Redis } from "ioredis";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SantosUser = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: 1 | 2 | 3 | 4;
  customRoleId: string | null;
  avatarUrl: string | null;
  suspendedAt: string | null;
  permissions?: Record<string, string[]>;
};

// Compat aliases para rotas legadas que leem req.user.roleId / req.user.usuario
export type AuthUser = SantosUser & {
  sub: string;          // = id
  usuario: string;      // = email
  roleId: 1 | 2 | 3;   // clamped — role 4 (Custom) retorna role efetivo via permissions
  iat: number;
  exp: number;
};

export type AuthRequest = Request & { user?: AuthUser };

// ─── Redis ────────────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 30;
const cacheKey = (userId: string) => `auth:session:${userId}`;

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL não configurado");
    _redis = new Redis(url, { lazyConnect: false, enableOfflineQueue: false });
  }
  return _redis;
}

async function getCached(userId: string): Promise<SantosUser | null> {
  try {
    const raw = await getRedis().get(cacheKey(userId));
    return raw ? (JSON.parse(raw) as SantosUser) : null;
  } catch {
    return null;
  }
}

async function setCache(user: SantosUser): Promise<void> {
  try {
    await getRedis().set(cacheKey(user.id), JSON.stringify(user), "EX", CACHE_TTL_SECONDS);
  } catch {}
}

// ─── Auth service fetch ───────────────────────────────────────────────────────

async function fetchFromAuthService(cookieToken: string): Promise<SantosUser | null> {
  const apiUrl = process.env.SANTOS_TECH_API_URL;
  if (!apiUrl) return null;
  try {
    const res = await fetch(`${apiUrl}/auth/me`, {
      headers: { Cookie: `access_token=${cookieToken}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: SantosUser };
    return data.user ?? null;
  } catch {
    return null;
  }
}

// ─── JWT local validation ─────────────────────────────────────────────────────

function extractUserId(token: string, secret: string): { sub: string; iat: number; exp: number } | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    if (!payload.sub) return null;
    return { sub: payload.sub, iat: Number(payload.iat ?? 0), exp: Number(payload.exp ?? 0) };
  } catch {
    return null;
  }
}

// ─── Map to legacy shape ──────────────────────────────────────────────────────

function toAuthUser(user: SantosUser, iat: number, exp: number): AuthUser {
  return {
    ...user,
    sub: user.id,
    usuario: user.email,
    roleId: (Math.min(user.role, 3) as 1 | 2 | 3),
    iat,
    exp,
  };
}

// ─── Middleware ────────────────────────────────────────────────────────────────

export function authGuard(_legacySecret?: string) {
  const secret = process.env.SANTOS_TECH_JWT_SECRET ?? process.env.JWT_SECRET ?? "";

  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const cookieToken = (req.cookies?.access_token as string | undefined);
    const bearerToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;

    const token = cookieToken ?? bearerToken;
    if (!token) return res.status(401).json({ code: "UNAUTHORIZED", message: "Não autenticado" });

    // 1. Valida JWT localmente — rápido, sem I/O
    const jwtData = extractUserId(token, secret);
    if (!jwtData) return res.status(401).json({ code: "UNAUTHORIZED", message: "Token inválido ou expirado" });

    // 2. Tenta cache Redis
    let user = await getCached(jwtData.sub);

    // 3. Cache miss → busca no auth service e popula cache
    if (!user) {
      if (!cookieToken) {
        return res.status(401).json({ code: "UNAUTHORIZED", message: "Token inválido ou expirado" });
      }
      user = await fetchFromAuthService(cookieToken);
      if (!user) return res.status(401).json({ code: "UNAUTHORIZED", message: "Sessão inválida" });
      await setCache(user);
    }

    // 4. Conta suspensa
    if (user.suspendedAt) {
      return res.status(403).json({ code: "ACCOUNT_SUSPENDED", message: "Conta suspensa" });
    }

    req.user = toAuthUser(user, jwtData.iat, jwtData.exp);
    return next();
  };
}
