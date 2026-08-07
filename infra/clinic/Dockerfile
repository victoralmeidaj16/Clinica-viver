FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY packages/core packages/core
COPY apps/web apps/web

RUN npm run web:build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@thats-life/web"]
