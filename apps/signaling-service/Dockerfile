FROM node:20-alpine AS builder

RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY scripts ./scripts
COPY packages/shared ./packages/shared
COPY apps/signaling-service ./apps/signaling-service

RUN npm install

# Generate Prisma Client (CRITICAL FIX)
RUN npm run db:generate -w @remotelink/shared

RUN npm run build -w @remotelink/shared
RUN npm run build -w @remotelink/signaling-service

FROM node:20-alpine

RUN apk add --no-cache openssl
WORKDIR /app

# Copy the entire workspace to ensure sub-workspace dependencies are found
COPY --from=builder /app ./

EXPOSE 3002

CMD ["node", "apps/signaling-service/dist/index.js"]
