<div align="center">

# Personal Control

Aplicacion para administrar finanzas, horas trabajadas, prestamos, metas de
ahorro, calendario, notas, reportes y estadisticas.

React · TypeScript · Vite · TailwindCSS · Express · Prisma · SQLite · Electron · Recharts

</div>

---

## Caracteristicas

| Modulo | Que hace |
|---|---|
| Dashboard | Dinero disponible, ingresos/gastos del mes, balance, horas, pago esperado, ahorro y prestamos |
| Registro rapido | Captura gastos, ingresos y notas en pocos toques |
| Ingresos | Registro con origen, categoria, metodo de pago, cuenta y observaciones |
| Gastos | Categorias editables y totales diario/semanal/mensual/anual |
| Presupuestos | Limites semanales, quincenales o mensuales por categoria |
| Horas de trabajo | Calculo automatico de horas reales, extras y pago esperado |
| Prestamos | "Yo preste" / "Me prestaron", abonos parciales, estados y vencimientos |
| Metas de ahorro | Objetivos con aportes y barra de progreso |
| Control de efectivo | Saldo en tiempo real por cuenta |
| Calendario | Ingresos, gastos, horas y prestamos por dia |
| Notas | Notas rapidas, pendientes y checklists |
| Estadisticas | Promedios, meses destacados, mayores movimientos y pago por hora |
| Reportes | Exportacion Excel y PDF filtrable por fechas y categoria |
| Respaldos | Copias de la base en escritorio y respaldos JSON en PWA |
| Multiusuario | Login local; el primer usuario es admin y puede ver todos los usuarios |
| Busqueda global | `Ctrl + K` encuentra movimientos en toda la app |
| Notificaciones | Prestamos por vencer, metas casi logradas y dias sin registrar |

Tema claro/oscuro, interfaz de escritorio y variante web/PWA offline.

## Inicio rapido

Requisitos: Node.js 20+ y npm.

```bash
git clone https://github.com/haku3212/app_personal.git
cd app_personal
node scripts/setup.mjs
npm run dev
```

Abre `http://127.0.0.1:5174`. Para probar la ventana de escritorio:

```bash
npm run dev:electron
```

## Windows

```bash
npm run dist
```

Genera el instalador NSIS en `release/`. La app empaquetada:

- guarda la base de datos en `%APPDATA%/personal-control/`,
- aplica migraciones al arrancar,
- crea un respaldo automatico al cerrar.

## PWA / Telefono

La opcion sin Mac es usarla como PWA desde el navegador del telefono. En modo
PWA usa la API local offline con almacenamiento del navegador, asi que no
necesita el backend Express para registrar datos.

```bash
npm run build:pwa
npm run preview:pwa
```

Detalles en [docs/PWA_TELEFONO.md](docs/PWA_TELEFONO.md).

## Scripts

| Comando | Descripcion |
|---|---|
| `npm run dev` | Backend + frontend en modo desarrollo |
| `npm run dev:electron` | Ventana Electron apuntando al dev server |
| `npm run build` | Compila backend, frontend y Electron |
| `npm run build:pwa` | Compila la PWA con API offline |
| `npm run preview:pwa` | Sirve la PWA compilada para probar/instalar |
| `npm run dist` | Build completo + instalador de Windows |
| `npm run typecheck` | TypeScript estricto |
| `npm run db:migrate` | Nueva migracion de Prisma en desarrollo |
| `npm run db:studio` | Prisma Studio para inspeccionar la base |

## Arquitectura

```txt
frontend/   React + Vite + Tailwind + Recharts
backend/    Express + Prisma + Zod
database/   schema.prisma + migraciones
electron/   Proceso principal de escritorio
docs/       Documentacion tecnica
public/     Recursos estaticos
scripts/    Utilidades
```

La UI usa `frontend/src/lib/api.ts`. En escritorio llama al backend HTTP; en PWA
cambia automaticamente a `frontend/src/lib/mobileApi.ts`.

## Licencia

[MIT](LICENSE) (c) haku3212
