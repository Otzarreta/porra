# Datos locales

Por defecto el servidor guarda aqui `porras.json`, `players.json`, `results.json`
y `meta.json`.

Estos JSON son datos vivos y no deben versionarse. En produccion configura `DATA_DIR`
fuera del checkout del repo, por ejemplo:

```bash
DATA_DIR=/var/lib/porra npm start
```

En Hostinger conviene apuntar `DATA_DIR` a una carpeta persistente fuera del repo,
por ejemplo `/home/u238991807/domains/porra.cloud/porra-data`.
