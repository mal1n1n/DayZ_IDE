import path from "node:path";

import { app, BrowserWindow, shell } from "electron";

import { startDesktopServer } from "../../desktop/src/server.mjs";

let serverHandle = null;
let mainWindow = null;

async function ensureServer() {
  if (serverHandle) return serverHandle;
  const port = Number(process.env.DZUI_ELECTRON_PORT ?? 0);
  serverHandle = await startDesktopServer({
    host: "127.0.0.1",
    port,
    log: true,
  });
  return serverHandle;
}

async function createMainWindow() {
  const server = await ensureServer();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: "DayZ IDE",
    icon: path.join(app.getAppPath(), "build", "icon.png"),
    backgroundColor: "#101418",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(server.url);
}

app.whenReady().then(createMainWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  serverHandle?.server.close();
});
