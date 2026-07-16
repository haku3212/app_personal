#!/usr/bin/env node
/**
 * Configuración inicial del proyecto en una máquina nueva:
 *   node scripts/setup.mjs
 *
 * 1. Instala dependencias (npm install ya genera el cliente Prisma).
 * 2. Crea/actualiza la base de datos de desarrollo con las migraciones.
 */
import { execSync } from "node:child_process";

const run = (cmd, env = {}) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
};

run("npm install");
run("npx prisma migrate deploy --schema database/prisma/schema.prisma", {
  DATABASE_URL: "file:dev.db",
});

console.log("\n✔ Listo. Ejecuta `npm run dev` para desarrollo o `npm run dist` para el instalador.");
