export type Role = "admin" | "professor" | "aluno";

export type AuthUser = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: number;
  avatarUrl: string | null;
  suspendedAt: string | null;
  permissions?: Record<string, string[]>;
};

// Module-level session state set after /auth/me check
let _user: AuthUser | null = null;

const AUTH_CHANGED_EVENT = "auth-changed";

export function setAuthUser(user: AuthUser | null) {
  _user = user;
  if (user) localStorage.setItem("nome", user.name);
  else localStorage.removeItem("nome");
}

export function getAuthUser(): AuthUser | null {
  return _user;
}

export function normalizeRole(input: unknown): Role | null {
  if (input === "admin" || input === 3 || input === "3") return "admin";
  if (input === "professor" || input === 2 || input === "2") return "professor";
  if (input === "aluno" || input === 1 || input === "1") return "aluno";
  return null;
}

export function getRole(): Role | null {
  return _user ? normalizeRole(_user.role) : null;
}

export function getName(): string | null {
  if (_user) return _user.name;
  const n = localStorage.getItem("nome");
  return n && n.trim().length > 0 ? n : null;
}

export function getUserId(): string | null {
  return _user?.id ?? null;
}

export function isLoggedIn(): boolean {
  return _user !== null;
}

export function hasRole(allowed: Role[]): boolean {
  const role = getRole();
  return !!role && allowed.includes(role);
}

export function onAuthChanged(handler: () => void) {
  const listener = () => handler();
  if (typeof window !== "undefined") {
    window.addEventListener(AUTH_CHANGED_EVENT, listener);
  }
  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener(AUTH_CHANGED_EVENT, listener);
    }
  };
}

export function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

export function logout() {
  setAuthUser(null);
  notifyAuthChanged();
}
