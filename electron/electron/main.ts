import path from "node:path";
import { existsSync } from "node:fs";
import { appendFileSync, mkdirSync } from "node:fs";
import http, { type Server as HttpServer } from "node:http";
import net from "node:net";
import dotenv from "dotenv";
import express, { type Express } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { app, BrowserWindow, shell } from "electron";
import { createDesktopUpdateService } from "./update-service";

const APP_NAME = "Painel - Portal Santos Tech";
const APP_ID = "com.santostech.painelportalsantostech.desktop";
const appRoot = path.join(__dirname, "..", "..");
dotenv.config({ path: path.join(appRoot, ".env") });
app.setName(APP_NAME);
if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

const devRendererUrl = "http://127.0.0.1:5173";
const rendererDistPath = path.join(appRoot, "renderer-dist");
const winIconPath = path.join(appRoot, "assets", "icon.ico");
const pngIconPath = path.join(appRoot, "assets", "icon.png");
const iconPath =
  process.platform === "win32" && existsSync(winIconPath) ? winIconPath : pngIconPath;
const apiOrigin =
  process.env.ELECTRON_API_ORIGIN?.trim() || "https://painel-portaldoaluno.santos-tech.com";
const wsOrigin = process.env.ELECTRON_WS_ORIGIN?.trim() || apiOrigin.replace(/^http/i, "ws");

let rendererServer: HttpServer | null = null;
let rendererServerUrl: string | null = null;
let logFilePath: string | null = null;

function writeLog(message: string) {
  try {
    if (!logFilePath) {
      const logDir = app.isReady()
        ? app.getPath("userData")
        : path.join(process.cwd(), ".electron-logs");
      mkdirSync(logDir, { recursive: true });
      logFilePath = path.join(logDir, "main.log");
    }

    appendFileSync(logFilePath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Sem fallback extra: falhar no log nao deve derrubar o app.
  }
}

const updateService = createDesktopUpdateService(writeLog);

function createMainWindow() {
  writeLog("Criando BrowserWindow.");
  const mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    writeLog(`Abrindo link externo: ${url}`);
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (!currentUrl || url === currentUrl) return;
    if (!/^https?:/i.test(url)) return;

    const currentOrigin = new URL(currentUrl).origin;
    const nextOrigin = new URL(url).origin;
    if (currentOrigin === nextOrigin) return;

    event.preventDefault();
    writeLog(`Bloqueando navegacao externa e abrindo no navegador: ${url}`);
    void shell.openExternal(url);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    writeLog(`Renderer carregado com sucesso: ${mainWindow.webContents.getURL()}`);
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      writeLog(
        `Falha ao carregar renderer. code=${errorCode} desc=${errorDescription} url=${validatedURL} mainFrame=${String(isMainFrame)}`
      );
    }
  );

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    writeLog(`Renderer caiu. reason=${details.reason} exitCode=${details.exitCode}`);
  });

  mainWindow.on("closed", () => {
    writeLog("Janela principal fechada.");
  });

  return mainWindow;
}

function canListen(port: number) {
  return new Promise<boolean>((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, "127.0.0.1");
  });
}

async function getAvailablePort(startPort: number) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }

  throw new Error("Nao foi possivel reservar uma porta para o renderer local.");
}

function createRendererApp() {
  const serverApp: Express = express();
  const apiProxy = createProxyMiddleware({
    target: apiOrigin,
    changeOrigin: true,
    ws: true,
    pathRewrite: (pathValue) => `/api${pathValue}`,
  });
  const wsProxy = createProxyMiddleware({
    target: wsOrigin,
    changeOrigin: true,
    ws: true,
    pathRewrite: (pathValue) => `/api/ws${pathValue}`,
  });

  serverApp.disable("x-powered-by");
  serverApp.use("/api", apiProxy);
  serverApp.use("/ws", wsProxy);
  serverApp.use(express.static(rendererDistPath));
  serverApp.get("*", (_req, res) => {
    res.sendFile(path.join(rendererDistPath, "index.html"));
  });

  return { serverApp, apiProxy, wsProxy };
}

async function startBundledRendererServer() {
  if (rendererServerUrl) {
    return rendererServerUrl;
  }

  if (!existsSync(rendererDistPath)) {
    writeLog(`renderer-dist ausente em ${rendererDistPath}`);
    throw new Error("renderer-dist nao encontrado. Rode npm run build em Portal-do-aluno/electron.");
  }

  const { serverApp, apiProxy, wsProxy } = createRendererApp();
  const port = await getAvailablePort(4173);

  rendererServer = http.createServer(serverApp);
  if (apiProxy.upgrade) {
    rendererServer.on("upgrade", apiProxy.upgrade);
  }
  if (wsProxy.upgrade) {
    rendererServer.on("upgrade", wsProxy.upgrade);
  }

  await new Promise<void>((resolve, reject) => {
    rendererServer?.once("error", reject);
    rendererServer?.listen(port, "127.0.0.1", () => resolve());
  });

  rendererServerUrl = `http://127.0.0.1:${port}`;
  writeLog(`Servidor local do renderer iniciado em ${rendererServerUrl} -> API ${apiOrigin}`);
  return rendererServerUrl;
}

async function loadRenderer(mainWindow: BrowserWindow) {
  if (!app.isPackaged) {
    try {
      await mainWindow.loadURL(devRendererUrl);
      writeLog(`Renderer de desenvolvimento carregado em ${devRendererUrl}`);
      return;
    } catch {
      // Fallback para o build local quando o dev server nao estiver no ar.
      writeLog("Dev server indisponivel; caindo para renderer empacotado/local.");
    }
  }

  const bundledUrl = await startBundledRendererServer();
  await mainWindow.loadURL(bundledUrl);
  writeLog(`Renderer local carregado em ${bundledUrl}`);
}

function stopRendererServer() {
  if (!rendererServer) return;
  rendererServer.close();
  rendererServer = null;
  rendererServerUrl = null;
}

app.whenReady().then(async () => {
  writeLog(
    `App pronta. packaged=${String(app.isPackaged)} apiOrigin=${apiOrigin} wsOrigin=${wsOrigin}`
  );
  try {
    const mainWindow = createMainWindow();
    await loadRenderer(mainWindow);
    updateService.scheduleStartupCheck();

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length > 0) return;
      const nextWindow = createMainWindow();
      await loadRenderer(nextWindow);
    });
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    writeLog(`Falha no startup do Electron: ${message}`);
    app.exit(1);
  }
});

app.on("window-all-closed", () => {
  writeLog("Todas as janelas foram fechadas.");
  stopRendererServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  writeLog("before-quit recebido.");
  stopRendererServer();
});

process.on("uncaughtException", (error) => {
  writeLog(`uncaughtException: ${error.message}\n${error.stack ?? ""}`);
});

process.on("unhandledRejection", (reason) => {
  writeLog(`unhandledRejection: ${String(reason)}`);
});
