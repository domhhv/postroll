# syntax=docker/dockerfile:1

# Build from the repo root: docker build -f apps/emails-worker/Dockerfile .
ARG NODE_VERSION=24.22.2

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
ENV HUSKY=0
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --filter "@postroll/emails-worker..." --filter "{.}"
RUN pnpm --filter "@postroll/emails-worker..." run build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm deploy --filter @postroll/emails-worker --prod --store-dir /pnpm/store /out

FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
CMD ["node", "dist/main.js"]
