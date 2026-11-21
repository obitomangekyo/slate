FROM node:26.13.1-trixie

WORKDIR /app

COPY . .

# Build the shared package first because the API imports its compiled output.
RUN node_version="$(cat .node-version)" \
  && test "$(node --version)" = "v${node_version}" \
  && pnpm_version="$(node -p "require('./package.json').packageManager.split('@')[1]")" \
  && curl -fsSL https://get.pnpm.io/install.sh | PNPM_VERSION="${pnpm_version}" sh - \
  && ln -s /root/.local/share/pnpm/bin/pnpm /usr/local/bin/pnpm \
  && CI=1 pnpm install --frozen-lockfile \
  && pnpm --filter @slate/shared build \
  && pnpm --filter @slate/api build

ENV NODE_ENV=production
# Fly routes HTTP traffic to this port inside the container.
ENV PORT=8080

EXPOSE 8080

CMD ["node", "apps/api/dist/index.js"]
