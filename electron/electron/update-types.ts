export type DesktopUpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "downloaded"
  | "error";

export type DesktopUpdateCheckSource = "startup" | "manual" | null;

export type DesktopUpdateState = {
  status: DesktopUpdateStatus;
  currentVersion: string;
  version: string | null;
  percent: number | null;
  transferredBytes: number | null;
  totalBytes: number | null;
  bytesPerSecond: number | null;
  checkedAt: string | null;
  message: string | null;
  source: DesktopUpdateCheckSource;
};

export const DESKTOP_UPDATE_STATE_CHANNEL = "desktop-updates:state";
export const DESKTOP_UPDATE_GET_STATE_CHANNEL = "desktop-updates:get-state";
export const DESKTOP_UPDATE_CHECK_CHANNEL = "desktop-updates:check";
export const DESKTOP_UPDATE_DOWNLOAD_CHANNEL = "desktop-updates:download";
export const DESKTOP_UPDATE_QUIT_AND_INSTALL_CHANNEL = "desktop-updates:quit-and-install";
