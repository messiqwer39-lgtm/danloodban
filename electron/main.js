const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");

const PORT = 34715;
let mainWindow = null;
let serverProc = null;

function toPortablePath(p) {
  return p.replace(/\\/g, "/");
}

function startServer() {
  const userData = app.getPath("userData");
  const resources = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, "..");
  const serverDir = app.isPackaged
    ? path.join(resources, "app-server")
    : path.join(__dirname, "..", ".next", "standalone");
  const samplesDir = app.isPackaged
    ? path.join(resources, "samples")
    : path.join(__dirname, "..", "storage", "samples");

  const dbPath = toPortablePath(path.join(userData, "danloodban.db"));
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    ELECTRON_NO_ATTACH_CONSOLE: "1",
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME: "127.0.0.1",
    DATABASE_URL: "file:" + dbPath,
    STORAGE_DIR: path.join(userData, "downloads"),
    SAMPLES_DIR: samplesDir,
  };

  serverProc = spawn(process.execPath, [path.join(serverDir, "server.js")], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProc.stdout.on("data", () => {});
  serverProc.stderr.on("data", (data) => {
    console.error(String(data).slice(0, 600));
  });
  serverProc.on("exit", () => {
    serverProc = null;
  });
}

function waitForServer(retries = 160) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      const req = http.get(
        { host: "127.0.0.1", port: PORT, path: "/api/downloads", timeout: 1500 },
        (res) => {
          res.resume();
          resolve();
        }
      );
      req.on("error", () => {
        if (left <= 0) {
          reject(new Error("server did not start"));
        } else {
          setTimeout(() => attempt(left - 1), 500);
        }
      });
      req.on("timeout", () => {
        req.destroy();
      });
    };
    attempt(retries);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    title: "دانلودبان",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  Menu.setApplicationMenu(null);
  try {
    await waitForServer();
    await mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });
  } catch (err) {
    dialog.showErrorBox(
      "خطا در راه‌اندازی",
      "سرور داخلی برنامه اجرا نشد. لطفاً برنامه را دوباره باز کنید."
    );
    app.quit();
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    startServer();
    void createWindow();
  });
  app.on("window-all-closed", () => {
    app.quit();
  });
  app.on("before-quit", () => {
    if (serverProc) {
      try {
        serverProc.kill();
      } catch {
        // نادیده گرفتن
      }
    }
  });
}
