# syntax=docker/dockerfile:1

# ---------- Stage 1: build ----------
FROM node:24.18.0-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

ARG NEXT_PUBLIC_SCHOOL_NAME="SMA Islam Al-Azhar 1 Jakarta"
ARG NEXT_PUBLIC_SCHOOL_SHORT="Al-Azhar 1"
ARG NEXT_PUBLIC_SCHOOL_NAME_SHORT="SMA Islam Al Azhar 1"
ARG NEXT_PUBLIC_STUDENT_DOMAIN="smaalazhar1.sch.id"
ARG NEXT_PUBLIC_STAFF_DOMAIN="smaalazhar1.sch.id"
ARG NEXT_PUBLIC_CRITICAL_POINTS="75"
ARG NEXT_PUBLIC_WARNING_POINTS="50"
ARG NEXT_PUBLIC_HEAVY_VIOLATION_POINTS="20"
ARG NEXT_PUBLIC_AUTH_GOOGLE_ENABLED="false"
ENV NEXT_PUBLIC_SCHOOL_NAME=$NEXT_PUBLIC_SCHOOL_NAME \
    NEXT_PUBLIC_SCHOOL_SHORT=$NEXT_PUBLIC_SCHOOL_SHORT \
    NEXT_PUBLIC_SCHOOL_NAME_SHORT=$NEXT_PUBLIC_SCHOOL_NAME_SHORT \
    NEXT_PUBLIC_STUDENT_DOMAIN=$NEXT_PUBLIC_STUDENT_DOMAIN \
    NEXT_PUBLIC_STAFF_DOMAIN=$NEXT_PUBLIC_STAFF_DOMAIN \
    NEXT_PUBLIC_CRITICAL_POINTS=$NEXT_PUBLIC_CRITICAL_POINTS \
    NEXT_PUBLIC_WARNING_POINTS=$NEXT_PUBLIC_WARNING_POINTS \
    NEXT_PUBLIC_HEAVY_VIOLATION_POINTS=$NEXT_PUBLIC_HEAVY_VIOLATION_POINTS \
    NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=$NEXT_PUBLIC_AUTH_GOOGLE_ENABLED \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build

RUN npx prisma generate
RUN npx next build

RUN npm prune --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:24.18.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/generated ./generated
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./next.config.js

EXPOSE 3000

CMD ["npm", "run", "start"]
