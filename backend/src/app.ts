/**
 * Fábrica de la aplicación Express.
 * Se usa tanto por el servidor standalone (desarrollo) como por Electron
 * (producción, embebida en el proceso principal).
 */
import express from "express";
import cors from "cors";
import type { Server } from "node:http";
import path from "node:path";
import fs from "node:fs";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { runMigrations } from "./lib/migrate";
import { seedDefaults } from "./seed";

export interface CreateAppOptions {
  /** Directorio del build del frontend a servir (solo producción). */
  staticDir?: string;
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const app = express();

  app.use(cors()); // la API solo escucha en 127.0.0.1, CORS abierto es seguro
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, app: "Personal Control" });
  });

  app.use("/api", apiRouter());

  // En producción, Electron sirve el build de Vite desde el mismo servidor.
  if (options.staticDir && fs.existsSync(options.staticDir)) {
    app.use(express.static(options.staticDir));
    // Fallback SPA: cualquier ruta que no sea /api devuelve index.html.
    app.get("*", (_req, res) => {
      res.sendFile(path.join(options.staticDir as string, "index.html"));
    });
  }

  app.use("/api", notFoundHandler);
  app.use(errorHandler);
  return app;
}

export interface StartedServer {
  port: number;
  url: string;
  close: () => void;
}

function listen(app: express.Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, "127.0.0.1");

    const onError = (err: NodeJS.ErrnoException) => {
      server.off("listening", onListening);
      reject(err);
    };

    const onListening = () => {
      server.off("error", onError);
      resolve(server);
    };

    server.once("error", onError);
    server.once("listening", onListening);
  });
}

/**
 * Arranca el servidor en 127.0.0.1 (nunca expuesto a la red).
 * Devuelve una promesa que se resuelve cuando está listo para aceptar tráfico.
 */
export async function startServer(
  port: number,
  options: CreateAppOptions = {},
): Promise<StartedServer> {
  await runMigrations();
  await seedDefaults();
  const app = createApp(options);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = port + attempt;
    try {
      const server = await listen(app, candidate);
      const url = `http://127.0.0.1:${candidate}`;
      if (candidate !== port) {
        console.warn(`[api] Puerto ${port} ocupado; usando ${candidate}.`);
      }
      console.log(`[api] Personal Control escuchando en ${url}`);
      return { port: candidate, url, close: () => server.close() };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EADDRINUSE") throw err;
    }
  }

  throw new Error(`No hay puertos libres entre ${port} y ${port + 19}.`);
}
