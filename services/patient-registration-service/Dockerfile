FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY shared ./shared
COPY services/patient-registration-service ./services/patient-registration-service

ENV NODE_ENV=production
ENV PORT=3003

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

CMD ["node", "services/patient-registration-service/src/server.js"]