# Production: frontend build + Express (serves SPA + /api)
# MySQL tashqi (Aiven). Env: DB_*, JWT_*, FRONTEND_ORIGIN, NODE_ENV=production

FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY fordata ./fordata
RUN cd frontend && npm ci
COPY frontend ./frontend
RUN cd frontend && npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend ./backend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

WORKDIR /app/backend
EXPOSE 5000
CMD ["node", "src/server.js"]
