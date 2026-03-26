import { contextBridge, ipcRenderer } from "electron";
import type { DesktopUpdateState } from "./update-types";
import {
  DESKTOP_UPDATE_CHECK_CHANNEL,
  DESKTOP_UPDATE_DOWNLOAD_CHANNEL,
  DESKTOP_UPDATE_GET_STATE_CHANNEL,
  DESKTOP_UPDATE_QUIT_AND_INSTALL_CHANNEL,
  DESKTOP_UPDATE_STATE_CHANNEL,
} from "./update-types";

contextBridge.exposeInMainWorld("desktop", {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  updates: {
    getState: () => ipcRenderer.invoke(DESKTOP_UPDATE_GET_STATE_CHANNEL) as Promise<DesktopUpdateState>,
    check: () => ipcRenderer.invoke(DESKTOP_UPDATE_CHECK_CHANNEL) as Promise<DesktopUpdateState>,
    download: () => ipcRenderer.invoke(DESKTOP_UPDATE_DOWNLOAD_CHANNEL) as Promise<DesktopUpdateState>,
    quitAndInstall: () =>
      ipcRenderer.invoke(DESKTOP_UPDATE_QUIT_AND_INSTALL_CHANNEL) as Promise<boolean>,
    subscribe: (listener: (state: DesktopUpdateState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: DesktopUpdateState) => {
        listener(state);
      };

      ipcRenderer.on(DESKTOP_UPDATE_STATE_CHANNEL, handler);
      return () => {
        ipcRenderer.removeListener(DESKTOP_UPDATE_STATE_CHANNEL, handler);
      };
    },
  },
});
