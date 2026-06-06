# syntax = docker/dockerfile:1

ARG NODE_VERSION=24.16.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="NestJS"

# NestJS app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Install pnpm
ARG PNPM_VERSION=11.5.2
RUN npm install -g pnpm@$PNPM_VERSION


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY --link . .
RUN pnpm install --frozen-lockfile --prod=false

# Build application
RUN pnpm turbo run build --filter @postroll/gateway...


# Final stage for app image
FROM base

# Copy built application with production dependencies
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 8080
CMD [ "pnpm", "--filter", "@postroll/gateway", "start:prod" ]
