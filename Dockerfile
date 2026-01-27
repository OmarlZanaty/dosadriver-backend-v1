FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# ✅ Generate Prisma client inside the image
RUN npx prisma generate

RUN npm run build


FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev

# ✅ Copy generated prisma client files
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/main.js"]
