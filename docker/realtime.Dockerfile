FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY realtime/package.json realtime/package.json
COPY shared/package.json shared/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build:shared && npm --workspace realtime run build

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
ENV NODE_ENV=production
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY realtime/package.json realtime/package.json
COPY shared/package.json shared/package.json
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/realtime
ENV NODE_ENV=production
ENV PORT=2567
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/package.json /app/package.json
COPY --from=prod-deps /app/package-lock.json /app/package-lock.json
COPY --from=prod-deps /app/backend/package.json /app/backend/package.json
COPY --from=prod-deps /app/frontend/package.json /app/frontend/package.json
COPY --from=prod-deps /app/realtime/package.json /app/realtime/package.json
COPY --from=prod-deps /app/shared/package.json /app/shared/package.json
COPY --from=build /app/realtime/build /app/realtime/build
COPY --from=build /app/shared/dist /app/shared/dist
COPY game-data /app/game-data
EXPOSE 2567
CMD ["node", "build/index.js"]
