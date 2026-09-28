FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 xbid
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY ponder.config.ts ponder.schema.ts tsconfig.json ./
COPY src ./src
RUN pnpm build && chown -R xbid:nodejs /app
USER xbid
EXPOSE 42069
CMD ["pnpm", "start", "--", "--hostname", "0.0.0.0", "--port", "42069"]
