#!/bin/sh
# Supervisor ruft "yarn expo start --port 3000" auf – dieses Projekt ist eine CRA/craco-Web-App,
# daher starten wir hier den Webpack-Dev-Server auf Port 3000 (Argumente werden ignoriert).
cd "$(dirname "$0")/.." || exit 1
export PORT=3000 HOST=0.0.0.0 BROWSER=none
exec node node_modules/.bin/craco start
