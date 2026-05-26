# Porra Mundial 2026

App Node.js/Express para gestionar una porra del Mundial 2026 con frontend en
`public/`, ranking server-side, persistencia JSON y scraper de 365Scores.

## Requisitos

- Node.js 18 o superior
- npm

## Desarrollo local

```bash
npm install
npm test
npm start
```

Por defecto escucha en `http://localhost:3000`.

Variables de entorno:

```bash
PORT=3000
ADMIN_TOKEN=cambia-este-token
DATA_DIR=/ruta/persistente/porra
```

Si no defines `DATA_DIR`, se usa `server/data`. Los JSON de esa carpeta son datos
vivos y estan ignorados por Git.

## Endpoints

- `GET /api/health`
- `GET /api/meta`
- `GET /api/porras`
- `GET /api/porras/:id`
- `POST /api/porras`
- `GET /api/results`
- `GET /api/ranking`
- `POST /api/admin/results` con header `x-admin-token`
- `POST /api/admin/scrape` con header `x-admin-token`

## GitHub

Repositorio previsto:

```bash
git remote add origin https://github.com/Otzarreta/porra.git
git branch -M main
git push -u origin main
```

## Hostinger

Esta app necesita ejecutar Node.js y mantener un proceso Express activo. En
Hostinger debes desplegarla como **Node.js Web App**, no como un deploy Git
estatico a `public_html`.

### Opcion recomendada: Business/Cloud con importacion GitHub

En hPanel:

1. Websites -> Add Website.
2. Selecciona Node.js Apps.
3. Selecciona Import Git Repository.
4. Autoriza GitHub y elige `Otzarreta/porra`, rama `main`.
5. Framework: `Express.js` si lo detecta; si no, `Other`.
6. Entry file: `server/server.js`.
7. Start command: `npm start` si aparece el campo.
8. Node.js version: 18 o superior.
9. Environment variables:
   - `ADMIN_TOKEN=tu-token-secreto`
   - `DATA_DIR=/ruta/persistente/porra`

No hay output directory ni build real: Express sirve `public/` directamente.

### Alternativa: VPS

Si usas VPS, preparala asi:

```bash
git clone https://github.com/Otzarreta/porra.git /var/www/porra
cd /var/www/porra
npm ci --omit=dev
mkdir -p /var/lib/porra
PORT=3000 ADMIN_TOKEN=tu-token DATA_DIR=/var/lib/porra npm start
```

Para dejarla persistente, usa un process manager como PM2 o systemd y configura
un reverse proxy del dominio hacia el puerto `PORT`.

### Nota sobre datos

Los JSON de porras/resultados no deben vivir dentro de Git. Si Hostinger no
mantiene persistente la ruta configurada en `DATA_DIR` entre redeploys, el paso
correcto sera cambiar la persistencia JSON por una base de datos.
