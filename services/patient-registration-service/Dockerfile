FROM node:20-alpine

WORKDIR /app

COPY services/patient-registration-service/package*.json ./services/patient-registration-service/
RUN cd ./services/patient-registration-service && npm ci --workspaces=false --omit=dev --ignore-scripts

COPY shared ./shared
COPY services/patient-registration-service ./services/patient-registration-service

WORKDIR /app/services/patient-registration-service

ENV NODE_ENV=production
ENV PORT=3003

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

CMD ["node", "src/server.js"]