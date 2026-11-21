FROM node:26.13.1-trixie

WORKDIR /app

COPY . .

# Build shared code before the web app because the web app imports it.
RUN node_version="$(cat .node-version)" \
  && test "$(node --version)" = "v${node_version}" \
  && pnpm_version="$(node -p "require('./package.json').packageManager.split('@')[1]")" \
  && curl -fsSL https://get.pnpm.io/install.sh | PNPM_VERSION="${pnpm_version}" sh - \
  && ln -s /root/.local/share/pnpm/bin/pnpm /usr/local/bin/pnpm \
  && CI=1 pnpm install --frozen-lockfile

ARG VITE_SITE_URL
ARG VITE_API_URL
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT
ARG VITE_SENTRY_SECURITY_ENDPOINT

ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter @slate/shared build \
  && pnpm --filter @slate/web build

ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=8080

EXPOSE 8080

CMD ["node", "apps/web/.output/server/index.mjs"]
