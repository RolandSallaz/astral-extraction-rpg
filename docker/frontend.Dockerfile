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
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_REALTIME_URL=ws://localhost:2567
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_REALTIME_URL=${NEXT_PUBLIC_REALTIME_URL}
COPY . .
RUN npm run build:shared && npm --workspace frontend run build

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY realtime/package.json realtime/package.json
COPY shared/package.json shared/package.json
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/frontend
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5173
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/package.json /app/package.json
COPY --from=prod-deps /app/package-lock.json /app/package-lock.json
COPY --from=prod-deps /app/backend/package.json /app/backend/package.json
COPY --from=prod-deps /app/frontend/package.json /app/frontend/package.json
COPY --from=prod-deps /app/realtime/package.json /app/realtime/package.json
COPY --from=prod-deps /app/shared/package.json /app/shared/package.json
COPY --from=build /app/frontend/.next /app/frontend/.next
COPY --from=build /app/frontend/next.config.ts /app/frontend/next.config.ts
COPY --from=build /app/frontend/public /app/frontend/public
COPY --from=build /app/shared/dist /app/shared/dist
COPY frontend/data /app/frontend/data
COPY game-data /app/game-data
EXPOSE 5173
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "5173"]
