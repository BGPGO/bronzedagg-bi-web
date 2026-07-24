FROM nginx:alpine

RUN apk add --no-cache nodejs npm dcron tini ca-certificates curl \
 && mkdir -p /app /var/log

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Scripts ETL + adapters
COPY adapters/ ./adapters/
COPY fetch-data.cjs build-data.cjs build-data-extras.cjs build-jsx.cjs ./
COPY bi.config.js ./
COPY components.jsx pages-*.jsx upsell-pages.jsx ./

# Site estático
COPY index.html styles.css /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Seed inicial (sobrescritos pelo cron)
COPY data.js app.bundle.js /usr/share/nginx/html/
COPY data-extras.js /usr/share/nginx/html/
COPY saldos.json /usr/share/nginx/html/

# Relatórios IA pré-gerados
COPY report-*.json /usr/share/nginx/html/

# Cron + entrypoint
COPY crontab /etc/crontabs/root
COPY refresh.sh entrypoint.sh download-xlsx.sh sync-supabase.sh /app/
RUN sed -i 's/\r$//' /app/*.sh /etc/crontabs/root \
 && chmod +x /app/refresh.sh /app/entrypoint.sh /app/download-xlsx.sh /app/sync-supabase.sh

EXPOSE 80
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/entrypoint.sh"]
