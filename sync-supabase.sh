#!/bin/sh
set -e
TS() { date '+%Y-%m-%d %H:%M:%S'; }
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "[$(TS)] sync-supabase: vars não definidas — pulando"; exit 0
fi
SLUG="${BI_SLUG:-bronzedagg}"
BUCKET="bi-data"
cd /app

upload() {
  local file="$1" ct="${2:-application/octet-stream}"
  local name=$(basename "$file")
  [ ! -f "$file" ] && return
  local status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${SLUG}/${name}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: ${ct}" -H "x-upsert: true" --data-binary "@${file}")
  echo "[$(TS)]   ${name}: ${status}"
}

echo "[$(TS)] sync-supabase: uploading slug=${SLUG}"
upload data.js application/javascript
upload app.bundle.js application/javascript
upload data-extras.js application/javascript
for f in report*.json; do [ -f "$f" ] && upload "$f" application/json; done
echo "[$(TS)] sync-supabase: concluído"
