FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=4000
ENV DATA_DIR=/data

VOLUME ["/data"]
EXPOSE 4000

CMD ["node", "server/index.js"]
