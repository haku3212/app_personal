/**
 * Proceso principal de Electron.
 *
 * - Desarrollo (`VITE_DEV_SERVER_URL` definida): carga Vite y usa el backend
 *   que corre por separado con `npm run dev`.
 * - Producción: arranca la API Express embebida en este mismo proceso,
 *   que además sirve el build del frontend, y apunta la base SQLite al
 *   directorio de datos del usuario (`userData`).
 */
import { app, BrowserWindow, shell } from "electron";
import fs from "node:fs";
import path from "node:path";

const PORT = 4310;
const DEV_URL = process.env.VITE_DEV_SERVER_URL;
/** Máximo de respaldos automáticos que se conservan al cerrar. */
const MAX_AUTO_BACKUPS = 10;

function databaseFile(): string {
  return path.join(app.getPath("userData"), "personal-control.db");
}

/** Arranca el backend embebido (solo producción). */
async function startEmbeddedApi(): Promise<void> {
  process.env.PC_DATA_DIR = app.getPath("userData");
  process.env.DATABASE_URL = `file:${databaseFile()}`;
  process.env.PC_MIGRATIONS_DIR = path.join(
    app.getAppPath(),
    "database",
    "prisma",
    "migrations",
  );

  // Import dinámico del backend compilado (viaja dentro del paquete).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const backend = require(path.join(app.getAppPath(), "backend", "dist", "app.js")) as {
    startServer: (port: number, opts: { staticDir?: string }) => Promise<unknown>;
  };
  await backend.startServer(PORT, {
    staticDir: path.join(app.getAppPath(), "frontend", "dist"),
  });
}

/** Respaldo automático al cerrar: copia la base y conserva las últimas 10. */
function autoBackupOnQuit(): void {
  try {
    const db = databaseFile();
    if (!fs.existsSync(db)) return;
    const dir = path.join(app.getPath("userData"), "backups");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    fs.copyFileSync(db, path.join(dir, `auto-${stamp}.sqlite`));

    // Poda: conserva solo los respaldos automáticos más recientes.
    const autos = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("auto-") && f.endsWith(".sqlite"))
      .sort()
      .reverse();
    for (const old of autos.slice(MAX_AUTO_BACKUPS)) {
      fs.unlinkSync(path.join(dir, old));
    }
  } catch (err) {
    console.error("[electron] Falló el respaldo automático:", err);
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0b0f",
    title: "Personal Control",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  // Los enlaces externos se abren en el navegador, nunca dentro de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  void win.loadURL(DEV_URL ?? `http://127.0.0.1:${PORT}`);
}

// Instancia única: si ya hay una ventana abierta, enfocarla.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  void app.whenReady().then(async () => {
    if (!DEV_URL) await startEmbeddedApi();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("before-quit", () => {
    if (!DEV_URL) autoBackupOnQuit();
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
