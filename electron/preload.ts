/**
 * Preload: puente seguro entre el renderer y el proceso principal.
 * Con contextIsolation activo, solo lo expuesto aquí es visible en la web.
 */
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("personalControl", {
  /** Versión de la app para mostrarla en Ajustes si se desea. */
  version: process.env.npm_package_version ?? "1.0.0",
  platform: process.platform,
});
