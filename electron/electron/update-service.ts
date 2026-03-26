import path from "node:path";
import { existsSync } from "node:fs";
import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import type { ProgressInfo } from "builder-util-runtime";
import {
  DESKTOP_UPDATE_CHECK_CHANNEL,
  DESKTOP_UPDATE_DOWNLOAD_CHANNEL,
  DESKTOP_UPDATE_GET_STATE_CHANNEL,
  DESKTOP_UPDATE_QUIT_AND_INSTALL_CHANNEL,
  DESKTOP_UPDATE_STATE_CHANNEL,
  type DesktopUpdateCheckSource,
  type DesktopUpdateState,
} from "./update-types";

const DEFAULT_UPDATES_URL = "https://cdn.portaldoaluno.santos-tech.com/desktop/painel/win";

type WriteLog = (message: string) => void;

function toRoundedPercent(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function normalizeErrorText(error: unknown) {
  if (!(error instanceof Error)) return "";

  const raw = error.message.trim();
  if (!raw) return "";

  return raw.replace(/\s+/g, " ");
}

function toErrorMessage(error: unknown) {
  const message = normalizeErrorText(error);
  if (!message) return "Nao foi possivel verificar atualizacoes agora.";

  if (message.includes("latest.yml") && message.includes("404")) {
    return "Feed de atualizacao nao encontrado (latest.yml). Publique a release desktop no CDN e tente novamente.";
  }

  if (
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ERR_CONNECTION") ||
    message.includes("ERR_INTERNET")
  ) {
    return "Nao foi possivel acessar o servidor de atualizacoes agora. Verifique a conexao e tente novamente.";
  }

  if (message.includes("sha512") || message.includes("checksum") || message.includes("blockmap")) {
    return "Os arquivos publicados de atualizacao parecem invalidos. Gere e publique a release novamente.";
  }

  const firstLine = message.split(/ at /, 1)[0]?.trim() || message;
  return firstLine.slice(0, 240);
}

function buildState(
  currentVersion: string,
  previousState: DesktopUpdateState,
  next: Partial<DesktopUpdateState>
): DesktopUpdateState {
  return {
    ...previousState,
    currentVersion,
    ...next,
  };
}

export function createDesktopUpdateService(writeLog: WriteLog) {
  const currentVersion = app.getVersion();
  const updatesUrl = process.env.DESKTOP_UPDATES_PUBLIC_URL?.trim() || DEFAULT_UPDATES_URL;
  const devUpdateConfigPath = path.join(app.getAppPath(), "dev-app-update.yml");

  let lastRequestedSource: DesktopUpdateCheckSource = null;
  let startupCheckScheduled = false;
  let pendingUpdateInfo: UpdateInfo | null = null;
  let downloadPromise: Promise<DesktopUpdateState> | null = null;
  let checkPromise: Promise<DesktopUpdateState> | null = null;
  let state: DesktopUpdateState = {
    status: "idle",
    currentVersion,
    version: null,
    percent: null,
    transferredBytes: null,
    totalBytes: null,
    bytesPerSecond: null,
    checkedAt: null,
    message: "Pronto para verificar atualizacoes.",
    source: null,
  };

  function broadcastState() {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) continue;
      window.webContents.send(DESKTOP_UPDATE_STATE_CHANNEL, state);
    }
  }

  function setState(next: Partial<DesktopUpdateState>) {
    state = buildState(currentVersion, state, next);
    broadcastState();
  }

  function setErrorState(error: unknown) {
    const message = toErrorMessage(error);
    writeLog(`Updater error: ${normalizeErrorText(error) || String(error)}`);
    setState({
      status: "error",
      version: pendingUpdateInfo?.version ?? state.version,
      percent: null,
      transferredBytes: null,
      totalBytes: null,
      bytesPerSecond: null,
      checkedAt: new Date().toISOString(),
      message,
      source: lastRequestedSource,
    });
  }

  function configureUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.channel = "latest";
    autoUpdater.setFeedURL({
      provider: "generic",
      url: updatesUrl,
      channel: "latest",
    });

    if (!app.isPackaged) {
      autoUpdater.forceDevUpdateConfig = true;
      writeLog(
        `Updater em modo dev. dev-app-update.yml presente=${String(existsSync(devUpdateConfigPath))}`
      );
    }
  }

  async function checkForUpdates(source: DesktopUpdateCheckSource) {
    lastRequestedSource = source;
    if (checkPromise) return checkPromise;

    checkPromise = autoUpdater
      .checkForUpdates()
      .then(() => state)
      .catch((error) => {
        setErrorState(error);
        return state;
      })
      .finally(() => {
        checkPromise = null;
      });

    return checkPromise;
  }

  async function downloadUpdate() {
    lastRequestedSource = "manual";
    if (state.status === "downloaded") return state;
    if (downloadPromise) return downloadPromise;
    if (state.status !== "available") return state;

    downloadPromise = autoUpdater
      .downloadUpdate()
      .then(() => state)
      .catch((error) => {
        setErrorState(error);
        return state;
      })
      .finally(() => {
        downloadPromise = null;
      });

    return downloadPromise;
  }

  function quitAndInstall() {
    if (state.status !== "downloaded") {
      return false;
    }

    writeLog(`Aplicando atualizacao ${state.version ?? "desconhecida"} com quitAndInstall.`);
    setState({
      message: "Reiniciando para instalar a atualizacao...",
    });

    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });

    return true;
  }

  function registerHandlers() {
    configureUpdater();

    autoUpdater.on("checking-for-update", () => {
      writeLog(`Verificando atualizacoes. source=${lastRequestedSource ?? "desconhecida"}`);
      setState({
        status: "checking",
        version: null,
        percent: null,
        transferredBytes: null,
        totalBytes: null,
        bytesPerSecond: null,
        message: "Verificando atualizacoes...",
        source: lastRequestedSource,
      });
    });

    autoUpdater.on("update-available", (info) => {
      pendingUpdateInfo = info;
      writeLog(`Atualizacao disponivel: ${info.version}`);
      setState({
        status: "available",
        version: info.version,
        percent: null,
        transferredBytes: null,
        totalBytes: null,
        bytesPerSecond: null,
        checkedAt: new Date().toISOString(),
        message: `Atualizacao ${info.version} disponivel para download.`,
        source: lastRequestedSource,
      });
    });

    autoUpdater.on("update-not-available", (info) => {
      pendingUpdateInfo = null;
      writeLog(`Sem atualizacoes. versao atual=${info.version}`);
      setState({
        status: "up-to-date",
        version: info.version,
        percent: null,
        transferredBytes: null,
        totalBytes: null,
        bytesPerSecond: null,
        checkedAt: new Date().toISOString(),
        message: "Voce ja esta na versao mais recente.",
        source: lastRequestedSource,
      });
    });

    autoUpdater.on("download-progress", (progress: ProgressInfo) => {
      const percent = toRoundedPercent(progress.percent);
      writeLog(`Download de update em andamento: ${percent ?? 0}%`);
      setState({
        status: "downloading",
        version: pendingUpdateInfo?.version ?? state.version,
        percent,
        transferredBytes: progress.transferred,
        totalBytes: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
        message: percent === null ? "Baixando atualizacao..." : `Baixando atualizacao... ${percent}%`,
        source: lastRequestedSource,
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      pendingUpdateInfo = info;
      writeLog(`Atualizacao baixada: ${info.version}`);
      setState({
        status: "downloaded",
        version: info.version,
        percent: 100,
        transferredBytes: state.totalBytes,
        totalBytes: state.totalBytes,
        bytesPerSecond: null,
        checkedAt: new Date().toISOString(),
        message: "Atualizacao pronta para instalar.",
        source: lastRequestedSource,
      });
    });

    autoUpdater.on("error", (error) => {
      setErrorState(error);
    });

    ipcMain.handle(DESKTOP_UPDATE_GET_STATE_CHANNEL, async () => state);
    ipcMain.handle(DESKTOP_UPDATE_CHECK_CHANNEL, async () => checkForUpdates("manual"));
    ipcMain.handle(DESKTOP_UPDATE_DOWNLOAD_CHANNEL, async () => downloadUpdate());
    ipcMain.handle(DESKTOP_UPDATE_QUIT_AND_INSTALL_CHANNEL, async () => quitAndInstall());
  }

  registerHandlers();

  return {
    getState: () => state,
    scheduleStartupCheck() {
      if (startupCheckScheduled) return;
      startupCheckScheduled = true;
      void checkForUpdates("startup");
    },
  };
}
