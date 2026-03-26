export type DesktopUpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "downloaded"
  | "error";

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
  source: "startup" | "manual" | null;
};

export type DesktopUpdatesApi = {
  getState: () => Promise<DesktopUpdateState>;
  check: () => Promise<DesktopUpdateState>;
  download: () => Promise<DesktopUpdateState>;
  quitAndInstall: () => Promise<boolean>;
  subscribe: (listener: (state: DesktopUpdateState) => void) => () => void;
};

export type DesktopBridge = {
  isElectron: boolean;
  platform: string;
  versions: {
    electron: string;
    chrome: string;
    node: string;
  };
  updates: DesktopUpdatesApi;
};

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}
