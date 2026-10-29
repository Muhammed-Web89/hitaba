# Hitaba API — Railway / Fly.io / Render için. Depo kökünden derlenir:
#   docker build -f apps/api/Dockerfile -t hitaba-api .
FROM node:22-slim AS build
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @hitaba/api --workspace @hitaba/shared --include-workspace-root

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @hitaba/shared \
 && cd apps/api && npx prisma generate && npx nest build

# Yalnızca çalışma zamanı bağımlılıkları (prisma CLI migration için runtime bağımlılığıdır)
RUN npm prune --omit=dev --workspace @hitaba/api --workspace @hitaba/shared --include-workspace-root

FROM node:22-slim
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 hitaba
ENV NODE_ENV=production
COPY --from=build --chown=hitaba /repo/node_modules node_modules
COPY --from=build --chown=hitaba /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build --chown=hitaba /repo/packages/shared/dist packages/shared/dist
COPY --from=build --chown=hitaba /repo/apps/api/package.json apps/api/package.json
COPY --from=build --chown=hitaba /repo/apps/api/dist apps/api/dist
COPY --from=build --chown=hitaba /repo/apps/api/prisma apps/api/prisma
COPY --from=build --chown=hitaba /repo/apps/api/scripts/prisma.mjs apps/api/scripts/prisma.mjs
USER hitaba
WORKDIR /repo/apps/api
EXPOSE 4000
# Açılışta Neon'a bekleyen migration'lar uygulanır (DATABASE_URL_UNPOOLED ile; scripts/prisma.mjs
# Prisma CLI'nin desteklemediği channel_binding parametresini ayıklar), sonra API başlar.
CMD ["sh", "-c", "node scripts/prisma.mjs migrate deploy && node dist/main.js"]
