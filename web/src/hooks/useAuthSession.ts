// Auth session is managed via httpOnly cookies set by auth.santos-tech.com.
// ProtectedRoute handles the /auth/me check and presence socket connection.
// This hook is kept as a no-op for backward compatibility with App.tsx.
export function useAuthSession() {}
