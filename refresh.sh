#!/bin/sh
set -e
if [ -f /etc/cron-env ]; then set -a; . /etc/cron-env; set +a; fi
cd /app
LOG=/var/log/refresh.log
TS() { date '+%Y-%m-%d %H:%M:%S'; }
exec > >(tee -a "$LOG") 2>&1

echo ""; echo "===== $(TS) refresh start ($1) ====="

SKIP_FETCH=0
if [ "$1" = "--boot" ] && [ -f data/_summary.json ]; then
  age=$(( $(date +%s) - $(stat -c %Y data/_summary.json 2>/dev/null || echo 0) ))
  [ "$age" -lt 86400 ] && echo "[$(TS)] boot: dados frescos ($age s) — pulando fetch" && SKIP_FETCH=1
fi

if [ "$SKIP_FETCH" = "0" ]; then
  [ -f /app/download-xlsx.sh ] && /app/download-xlsx.sh || echo "[$(TS)] download-xlsx falhou (continua)"
  echo "[$(TS)] fetch-data.cjs"
  node fetch-data.cjs || echo "[$(TS)] fetch-data falhou (continua)"
fi

if [ -f data/movimentos.json ]; then
  echo "[$(TS)] build-data.cjs"; node build-data.cjs
  echo "[$(TS)] build-data-extras.cjs"; node build-data-extras.cjs 2>/dev/null || true
  echo "[$(TS)] build-jsx.cjs"; node build-jsx.cjs
  cp -f data.js app.bundle.js /usr/share/nginx/html/
  cp -f data-extras.js /usr/share/nginx/html/ 2>/dev/null || true
  cp -f report*.json /usr/share/nginx/html/ 2>/dev/null || true
  cp -f reports.js /usr/share/nginx/html/ 2>/dev/null || true
  echo "[$(TS)] refresh OK — data.js atualizado"
  [ -f /app/sync-supabase.sh ] && /app/sync-supabase.sh || echo "[$(TS)] sync-supabase falhou (continua)"
else
  echo "[$(TS)] data/movimentos.json ausente — servindo dados antigos"
fi
echo "===== $(TS) refresh end ====="
