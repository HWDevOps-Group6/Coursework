FROM node:20-alpine

WORKDIR /app

COPY services/diagnostics-vitals-service/package*.json ./services/diagnostics-vitals-service/
RUN cd ./services/diagnostics-vitals-service && npm ci --workspaces=false --omit=dev --ignore-scripts

COPY shared ./shared
COPY services/diagnostics-vitals-service ./services/diagnostics-vitals-service

WORKDIR /app/services/diagnostics-vitals-service

ENV NODE_ENV=production
ENV PORT=3004

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

CMD ["node", "server.js"]