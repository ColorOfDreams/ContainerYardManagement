# ============================================================
# Dockerfile — Management Service
# ============================================================

# ---------- STAGE 1: deps — cài toàn bộ dependencies ----------
# giống tạo máy ảo hoặc tạo một xưởng gia công
# Bắt đầu từ  môi trường nền là node:22-alpine 
# node:22-alpine là image chính thức của Node.js, dựa trên Alpine Linux (nhẹ, bảo mật tốt)
# Ví dụ giống như 1 ngôi nhà thì có sẵn nhà rồi chỉ thêm đồ vào thôi thay vì tự xây lại 1 căn khác
# Bắt đầu từ đâu /
FROM node:22-alpine AS deps

# Làm việc trong thư mục /app (nếu chưa có thì tạo mới) đại khái giống lệnh cd /app và mkdir -p /app
# Làm việc ở đâu
WORKDIR /app

# Lấy file từ packe.json và package-lock.json từ máy host vào image (vào thư mục /app)
COPY package.json package-lock.json ./

# Chạy câu lệnh trong docker
# Đang làm gì
RUN npm ci

# ---------- STAGE 2: build — biên dịch TypeScript ----------
# Nếu như ở stage 1 thì nó đang là như một máy thì stage 2 này lấy công cụ và cho sản phẩm vào gia công
# Dùng node 22 đã cài ở bước 1 để build
FROM node:22-alpine AS build
WORKDIR /app
# Từ deps copy và chạy node_modules để chạy run build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- STAGE 3: production — image gọn, chỉ chứa những gì cần để CHẠY ----------
# Gia công haonf thiện chỉ cần dóng gói lại và bàn giao sản phẩm nên cần nhẹ nhất
# Tạo lại môi trường ảo mới tinh
FROM node:22-alpine AS production
WORKDIR /app

# Dùng env
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# Chỉ cài dependencies production (bỏ qua devDependencies như @nestjs/cli, typescript...)
RUN npm ci --omit=dev

# Lấy code đã build (dist/), không copy source .ts hay node_modules dev vào image cuối.
COPY --chown=node:node --from=build /app/dist ./dist

# Lấy sản phẩm đã build hoặc gia công từ stage 2
COPY --chown=node:node --from=build /app/db ./db

# Khai báo port mà container sẽ lắng nghe (3001)
EXPOSE 3001

USER node

# Healthcheck để docker-compose/Docker biết container đã "khỏe" hay chưa
# Dùng endpoint GET /health đã viết trong health.controller.ts
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3001/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
