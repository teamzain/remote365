FROM node:20-alpine AS builder

RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY scripts ./scripts
COPY packages/shared ./packages/shared
COPY apps/billing-service ./apps/billing-service

RUN npm install

# Generate Prisma Client (CRITICAL FIX)
RUN npm run db:generate -w @remotelink/shared

RUN npm run build -w @remotelink/shared
RUN npm run build -w @remotelink/billing-service

FROM node:20-alpine

RUN apk add --no-cache openssl
WORKDIR /app

# Copy the entire workspace to ensure sub-workspace dependencies are found
COPY --from=builder /app ./

EXPOSE 3004

CMD ["node", "apps/billing-service/dist/index.js"]
