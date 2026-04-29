const trimEnv = (value: string | undefined) => value?.trim() || undefined;

const apiUrl =
  trimEnv(import.meta.env.VITE_API_URL) ||
  trimEnv(process.env.API_URL) ||
  "/api";

export const env = {
  apiUrl,
  pointsApiUrl:
    trimEnv(import.meta.env.VITE_POINTS_API_URL) ||
    trimEnv(process.env.POINTS_API_URL) ||
    apiUrl,
  wsUrl: trimEnv(import.meta.env.VITE_WS_URL),
  desktopInstallerUrl: trimEnv(import.meta.env.VITE_DESKTOP_INSTALLER_URL),
  isDev: import.meta.env.DEV,
} as const;
