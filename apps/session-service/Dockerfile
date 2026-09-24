FROM node:20-alpine AS builder

RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY scripts ./scripts
COPY packages/shared ./packages/shared
COPY apps/session-service ./apps/session-service

RUN npm install

# Generate Prisma Client (CRITICAL FIX)
RUN npm run db:generate -w @remotelink/shared

RUN npm run build -w @remotelink/shared
RUN npm run build -w @remotelink/session-service

FROM node:20-alpine

RUN apk add --no-cache openssl
WORKDIR /app

# Copy the entire workspace to ensure sub-workspace dependencies are found
COPY --from=builder /app ./

EXPOSE 3003

CMD ["node", "apps/session-service/dist/index.js"]
