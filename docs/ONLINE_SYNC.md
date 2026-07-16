# Sincronizacion online

La app puede trabajar en dos modos:

1. **PWA offline**: datos en el navegador/dispositivo.
2. **Online**: frontend en Netlify conectado a un backend con `VITE_API_URL`.

## Estado actual

Esta etapa agrega:

- modelos `User` y `Session` en Prisma,
- `ownerId` en cuentas, categorias, ingresos, gastos, horas, prestamos, metas y notas,
- registro/login online en `/api/auth`,
- administracion de usuarios online en `/api/users`,
- tokens Bearer revocables,
- frontend preparado para usar `VITE_API_URL`,
- filtros por usuario actual y por usuario seleccionado cuando entra el admin,
- datos base privados para cada usuario nuevo.

Un usuario normal solo ve y edita su propia informacion. El admin puede cambiar
el usuario activo desde la app y ver los datos de esa persona sin mezclar datos.

## Activar modo online en Netlify

Cuando el backend este desplegado, configurar en Netlify:

```txt
VITE_API_URL=https://TU-BACKEND.example.com
```

La app prioriza esa URL y deja de usar la base local para las llamadas API.

## Nota de admin

El primer usuario creado en una base online vacia queda como `ADMIN`. Los
usuarios siguientes quedan como `USER`, y la API bloquea que se creen o promuevan
nuevos admins desde la app.
