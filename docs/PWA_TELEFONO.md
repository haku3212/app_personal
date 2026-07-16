# Personal Control en telefono

Esta opcion usa la app como web/PWA. No requiere herramientas nativas.

## Probar en la PC

```bash
npm run build:pwa
npm run preview:pwa
```

Queda disponible en:

```txt
http://127.0.0.1:5175/#/
```

Esa URL solo funciona en la misma PC. Para verla desde el telefono necesitas una
URL accesible desde el telefono.

## Opcion A: misma red Wi-Fi

Sirve para probar en casa.

1. Busca la IP local de la PC con `ipconfig`.
2. Sirve la PWA escuchando en la red:

```bash
npm run build:pwa
npm run preview --workspace frontend -- --host 0.0.0.0 --port 5175
```

3. En el telefono abre:

```txt
http://IP-DE-TU-PC:5175/#/
```

Ejemplo:

```txt
http://192.168.1.20:5175/#/
```

La PC debe estar prendida y el firewall debe permitir ese puerto.

## Opcion B: desde cualquier lugar

Para usarla fuera de casa necesitas alojarla con HTTPS. La PWA offline puede
subirse como sitio estatico a servicios como:

- Netlify
- Vercel
- Cloudflare Pages
- GitHub Pages

Comando de build:

```bash
npm run build:pwa
```

Carpeta para publicar:

```txt
frontend/dist
```

En esta modalidad los datos viven en el navegador de cada dispositivo. Si abres
la app en tu telefono, ese telefono tiene su propia informacion local. Si abres
la app en otra PC, esa PC tendra otra informacion local.

## Si quieres datos sincronizados

Para que el telefono y la PC compartan la misma base de datos necesitas alojar
tambien el backend y la base de datos. Esa es otra arquitectura:

- frontend en Vercel/Netlify/Cloudflare Pages,
- backend Express en Render/Railway/Fly.io/VPS,
- base de datos persistente, idealmente Postgres.

La PWA actual esta pensada para funcionar offline por dispositivo.
