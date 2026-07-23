#!/bin/sh
set -e
mkdir -p /var/log
touch /var/log/refresh.log
env | grep -E '^(XLSX_|BI_|COOLIFY_|SUPABASE_)' > /etc/cron-env || true
chmod 600 /etc/cron-env
( /app/refresh.sh --boot & ) &
crond -b -L /var/log/cron.log
exec nginx -g 'daemon off;'
