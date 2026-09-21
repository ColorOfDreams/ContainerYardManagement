# ============================================================
# Dockerfile — Management Service
# Multi-stage build: tách bước "build" (cần devDependencies, TypeScript...)
# ra khỏi image chạy thật (chỉ cần code đã build + dependencies production)
# => image cuối nhỏ hơn nhiều, không lẫn source TS/công cụ build vào production.
# ============================================================

# ---------- STAGE 1: deps — cài toàn bộ dependencies (kể cả dev) ----------
FROM node:22-alpine AS deps
WORKDIR /app
# Copy package.json trước, cài dependencies trước khi copy code còn lại:
# Docker cache layer theo từng lệnh — nếu package.json không đổi, lần build
# sau sẽ tái dùng cache ở bước "npm ci" này, không cài lại từ đầu => build nhanh hơn.
COPY package.json package-lock.json* ./
RUN npm install

# ---------- STAGE 2: build — biên dịch TypeScript + sinh Prisma Client ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------- STAGE 3: production — image gọn, chỉ chứa những gì cần để CHẠY ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
# Chỉ cài dependencies production (bỏ qua devDependencies như @nestjs/cli, typescript...)
RUN npm install --omit=dev

# Lấy code đã build (dist/) và Prisma Client đã generate từ stage build,
# không copy source .ts hay node_modules dev vào image cuối.
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma

EXPOSE 3001

# Healthcheck để docker-compose/Docker biết container đã "khỏe" hay chưa
# (dùng chính endpoint GET /health đã viết trong health.controller.ts)
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3001/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
