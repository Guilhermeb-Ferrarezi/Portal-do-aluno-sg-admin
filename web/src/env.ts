import { API_BASE_URL as sharedApiBaseUrl } from "../../../home/web/src/lib/env";

const trimEnv = (value: string | undefined) => value?.trim() || undefined;

export const env = {
  apiUrl: trimEnv(sharedApiBaseUrl) || trimEnv(import.meta.env.VITE_API_URL) || "/api",
  wsUrl: trimEnv(import.meta.env.VITE_WS_URL),
  desktopInstallerUrl: trimEnv(import.meta.env.VITE_DESKTOP_INSTALLER_URL),
  isDev: import.meta.env.DEV,
} as const;
