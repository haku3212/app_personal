# PERSONAL CONTROL — Plan de Desarrollo por Fases

> Aplicación de escritorio **offline** para Windows: finanzas personales, horas trabajadas,
> préstamos, ahorros y estadísticas. Arquitectura pensada como producto comercial.

---

## Fase 0 — Fundaciones (infraestructura)

**Objetivo:** que todo el equipo (presente y futuro) trabaje sobre una base sólida.

- [x] Monorepo con `npm workspaces` (`backend/`, `frontend/`).
- [x] TypeScript **estricto** en los 3 procesos (backend, frontend, electron).
- [x] Prisma + SQLite con esquema normalizado y migraciones (`database/prisma/`).
- [x] Scripts npm unificados en la raíz (`dev`, `build`, `dist`).
- [x] `.gitignore`, Licencia MIT, README profesional.

## Fase 1 — Núcleo de datos (backend)

**Objetivo:** API REST local completa, validada y tipada.

- [x] Servidor Express embebible (mismo proceso que Electron en producción).
- [x] Validación con **Zod** en todas las entradas.
- [x] Manejo de errores centralizado (`ApiError` + middleware).
- [x] Módulos CRUD: cuentas, categorías, ingresos, gastos, horas, préstamos (+abonos),
      metas (+aportes), notas (+checklist), ajustes.
- [x] Semilla automática de datos por defecto (categorías, cuentas, ajustes) al primer arranque.

## Fase 2 — Inteligencia de negocio

**Objetivo:** todo lo que se calcula, se calcula en un solo lugar (backend).

- [x] Dashboard: dinero disponible, ingresos/gastos del mes, balance, horas, pago esperado,
      ahorro acumulado, prestado / por cobrar, series para gráficos.
- [x] Estadísticas: promedios diarios/mensuales, mes más caro, mes con más ingresos,
      mayor gasto/ingreso, horas por mes, pago promedio.
- [x] Notificaciones calculadas: préstamos vencidos/por vencer, metas cerca del objetivo,
      días sin registrar gastos u horas.
- [x] Búsqueda global sobre todos los movimientos.
- [x] Control de efectivo: saldo en tiempo real por cuenta (caja, banco, efectivo).

## Fase 3 — Interfaz (frontend)

**Objetivo:** UI moderna estilo Notion / Linear / Raycast.

- [x] Vite + React + TailwindCSS + componentes estilo shadcn/ui + Lucide Icons.
- [x] Tema claro / oscuro persistente, animaciones suaves, 100% responsive.
- [x] Layout con sidebar, topbar y buscador global (Ctrl + K).
- [x] Páginas: Dashboard, Ingresos, Gastos, Horas, Préstamos, Metas, Efectivo,
      Calendario, Notas, Estadísticas, Reportes, Ajustes.
- [x] Gráficos con Recharts (ingresos por mes, gastos por categoría, horas, ahorro, balance).

## Fase 4 — Exportación y respaldos

- [x] Reportes **Excel** y **PDF** filtrables por fechas / categoría / tipo.
- [x] Respaldos de la base SQLite con un botón + restauración + exportar/importar archivo.

## Fase 5 — Escritorio (Electron)

- [x] Proceso principal en TypeScript, `preload` con `contextIsolation`.
- [x] En desarrollo carga Vite; en producción sirve el build y arranca la API embebida.
- [x] `electron-builder` configurado para generar instalador **NSIS de Windows**.

## Fase 6 — Futuro (sin romper la arquitectura)

Cada módulo nuevo = 1 carpeta en `backend/src/modules/` + 1 página en `frontend/src/pages/`
+ modelos en `schema.prisma` + 1 entrada en el sidebar. Candidatos ya previstos:

vehículos · inventario personal · proyectos · estudios · agenda · salud · impuestos ·
inversiones · criptomonedas.

---

## Reglas de calidad permanentes

1. TypeScript estricto, sin `any` gratuito.
2. Toda entrada del usuario pasa por Zod antes de tocar la base de datos.
3. Los cálculos financieros viven en el backend, la UI solo presenta.
4. Nada de lógica duplicada: helpers compartidos en `lib/` y `utils/`.
5. Cada módulo es autocontenido y desmontable.
