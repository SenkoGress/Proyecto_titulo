# Stage 1: Build TypeScript application
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY backend ./backend

RUN npm run build

# Stage 2: Production runtime
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY backend/src/database/postgres/migrations ./dist/backend/src/database/postgres/migrations
COPY backend/src/database/sqlite/migrations ./dist/backend/src/database/sqlite/migrations
COPY backend/public ./dist/backend/public
COPY backend/public ./backend/public

EXPOSE 3000

USER node

CMD ["node", "dist/backend/src/index.js"]
