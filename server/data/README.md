# Datos locales

Por defecto el servidor guarda aqui `porras.json`, `results.json` y `meta.json`.

Estos JSON son datos vivos y no deben versionarse. En produccion configura `DATA_DIR`
fuera del checkout del repo, por ejemplo:

```bash
DATA_DIR=/var/lib/porra npm start
```

