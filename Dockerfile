FROM node:22-trixie

RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-21-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./frontend/

WORKDIR /app/frontend
RUN npm ci

WORKDIR /app
COPY . .

WORKDIR /app/frontend
ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]