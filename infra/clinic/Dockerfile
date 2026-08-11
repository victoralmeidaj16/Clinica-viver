FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY packages/core packages/core
COPY apps/web apps/web
COPY infra/mysql infra/mysql
COPY infra/clinic infra/clinic

RUN npm run web:build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Preenchido pelo deploy. Não é segredo: serve para identificar o código que
# está atendendo uma requisição na VPS, que recebe arquivos por rsync.
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION

COPY --from=build /app /app

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@thats-life/web"]
