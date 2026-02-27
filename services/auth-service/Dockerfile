FROM node:20-alpine

WORKDIR /app

COPY services/auth-service/package*.json ./services/auth-service/
RUN npm ci --omit=dev --prefix ./services/auth-service

COPY shared ./shared
COPY services/auth-service/src ./services/auth-service/src

WORKDIR /app/services/auth-service

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

CMD ["npm", "start"]
