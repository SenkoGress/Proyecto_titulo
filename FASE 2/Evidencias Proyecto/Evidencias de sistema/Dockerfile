# Etapa 1: compila el servidor y construye la interfaz
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY backend ./backend
COPY scripts ./scripts
RUN npm run build

COPY front-end/package*.json ./front-end/
RUN npm --prefix front-end ci
COPY front-end ./front-end
RUN npm --prefix front-end run build

# Etapa 2: solo lo necesario para correr
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV FRONTEND_DIST=/app/front-end/dist

COPY package*.json ./
RUN npm ci --omit=dev

# dist ya trae las migraciones: las copia el script de compilacion
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/front-end/dist ./front-end/dist
COPY semillas ./semillas

RUN mkdir -p /app/data && chown -R node:node /app/data

EXPOSE 3000

USER node

CMD ["node", "dist/backend/src/index.js"]
