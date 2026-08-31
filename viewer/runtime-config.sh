#!/bin/sh
set -eu
value="${API_BASE_URL:-${VITE_API_BASE:-http://localhost:8000}}"
if [ "$value" = "https://peblo-api.onrender.com" ]; then value="https://peblo-api-l2mv.onrender.com"; fi
printf 'window.__PEBLO_API_BASE__ = "%s";\n' "$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g')" > /usr/share/nginx/html/config.js
