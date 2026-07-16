# Sincronizacion online

La app puede trabajar en dos modos:

1. **PWA offline**: datos en el navegador/dispositivo.
2. **Online**: frontend en Netlify conectado a un backend con `VITE_API_URL`.

## Estado actual

Esta etapa agrega:

- modelos `User` y `Session` en Prisma,
- registro/login online en `/api/auth`,
- administracion de usuarios online en `/api/users`,
- tokens Bearer revocables,
- frontend preparado para usar `VITE_API_URL`.

## Activar modo online en Netlify

Cuando el backend este desplegado, configurar en Netlify:

```txt
VITE_API_URL=https://TU-BACKEND.example.com
```

La app prioriza esa URL y deja de usar la base local para las llamadas API.

## Pendiente para sincronizacion completa

Todavia falta asociar cada registro financiero a un usuario en la base online:

- `Income.ownerId`
- `Expense.ownerId`
- `WorkLog.ownerId`
- `Loan.ownerId`
- `SavingGoal.ownerId`
- `Note.ownerId`
- `Account.ownerId`
- `Category.ownerId`

Luego cada router debe filtrar por:

- usuario actual para cuentas normales,
- usuario seleccionado para admin.

Hasta completar esa etapa, la base online ya puede autenticar usuarios, pero los
datos financieros del backend siguen siendo globales.
