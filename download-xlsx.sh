#!/bin/sh
set -e
TS() { date '+%Y-%m-%d %H:%M:%S'; }
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "[$(TS)] download-xlsx: SUPABASE_URL ou SUPABASE_SERVICE_KEY nao definido — pulando"
  exit 0
fi

BUCKET="bi-excel"
WORKSPACE="/app/workspace"
mkdir -p "$WORKSPACE"

download() {
  local supa_path="$1" local_path="$2"
  local status=$(curl -s -o "$local_path" -w "%{http_code}" \
    "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${supa_path}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}")
  if [ "$status" = "200" ]; then echo "[$(TS)]   ok: $(basename "$local_path")"
  else echo "[$(TS)]   FAIL ($status): $supa_path"; rm -f "$local_path"; fi
}

echo "[$(TS)] download-xlsx: baixando arquivos Bronze da GG..."

# Conta Azul (extrato financeiro)
download "bronzedagg-caixa/extrato_financeiroBronzedagg.xlsx" "${WORKSPACE}/extrato_financeiroBronzedagg.xlsx"

# Trinks (faturamento - gerado pelo scraper, nomeado como o config espera)
download "bronzedagg-caixa/faturamento_trinks.xlsx" "${WORKSPACE}/[Grupo BGG] Faturamento 2026.xlsx"

echo "[$(TS)] download-xlsx: concluido"
