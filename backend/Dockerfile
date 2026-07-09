# ---- deps: install with native build tools for bcrypt ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
COPY package*.json ./
RUN npm ci

# ---- build: compile TypeScript + generate Prisma client ----
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runtime: production deps only ----
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]
