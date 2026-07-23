#!/bin/bash
# daily-refresh-trinks.sh — Atualização diária do BI Bronze da GG
#
# Roda o scraper Trinks, rebuilda os dados e faz deploy no Coolify.
# Deve ser configurado como cron job no BGP server.
#
# Cron sugerido (todos os dias às 06:00 BRT):
#   0 9 * * * /path/to/bronzedagg-bi-web/daily-refresh-trinks.sh >> /var/log/bronzedagg-refresh.log 2>&1
#   (09:00 UTC = 06:00 BRT)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

echo ""
echo "=============================================="
echo "$LOG_PREFIX INÍCIO — daily-refresh-trinks"
echo "=============================================="

# 1. Scrape Trinks (só mês atual, headless)
echo "$LOG_PREFIX Rodando scraper Trinks..."
node scrape-trinks.cjs --daily --headless
echo "$LOG_PREFIX Scraper OK"

# 2. Fetch (adapter lê XLSX gerado pelo scraper + Conta Azul)
echo "$LOG_PREFIX Fetch data..."
node fetch-data.cjs
echo "$LOG_PREFIX Fetch OK"

# 3. Build (gera data.js, app.bundle.js)
echo "$LOG_PREFIX Build..."
node bgp-bi.cjs build
echo "$LOG_PREFIX Build OK"

# 4. Commit e push se houve mudanças
if git diff --quiet HEAD -- data.js data-extras.js app.bundle.js data/ 2>/dev/null; then
  echo "$LOG_PREFIX Sem mudanças nos dados — skip commit"
else
  echo "$LOG_PREFIX Commitando mudanças..."
  git add data.js data-extras.js app.bundle.js data/ -f
  git commit -m "chore(bronzedagg): atualização diária Trinks $(date '+%Y-%m-%d')" \
    --author="BGP Bot <bot@bertuzzipatrimonial.com.br>"
  git push origin main
  echo "$LOG_PREFIX Push OK"
fi

# 5. Deploy Coolify
echo "$LOG_PREFIX Disparando deploy Coolify..."
COOLIFY_TOKEN="${COOLIFY_TOKEN:-97|Q0l5dVIdAG998jEbDdtmKNtLu2e97vXRxtirB0xX1bf2926e}"
COOLIFY_UUID="lzsuuej0c72mz6h4vjjb0ruj"

DEPLOY_RESULT=$(curl -sk "http://187.77.238.125:8000/api/v1/deploy?uuid=${COOLIFY_UUID}&force=true" \
  -H "Authorization: Bearer ${COOLIFY_TOKEN}" 2>&1)
echo "$LOG_PREFIX Deploy: $DEPLOY_RESULT"

echo ""
echo "=============================================="
echo "$LOG_PREFIX FIM — daily-refresh-trinks"
echo "=============================================="
