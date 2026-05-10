FROM oven/bun:1.3.13 AS development-dependencies-env
ENV NODE_ENV=development
COPY . /
WORKDIR /
RUN bun ci

FROM oven/bun:1.3.13 AS production-dependencies-env
COPY . /
WORKDIR /
RUN bun ci --production --ignore-scripts

FROM oven/bun:1.3.13 AS build-env
COPY . /
COPY --from=development-dependencies-env /node_modules /node_modules
WORKDIR /apps/server
# Installs prisma for db:generate
RUN bun install --frozen-lockfile
# Prisma generate only needs a syntactically valid URL at build time.
ENV DATABASE_URL=file:./data/dev.db
RUN bun run db:generate

FROM oven/bun:1.3.13
COPY --from=production-dependencies-env / /
COPY --from=build-env /apps/server/node_modules /apps/server/node_modules
COPY --from=build-env /apps/server/generated /apps/server/generated
WORKDIR /apps/server
CMD ["bun", "run", "start"]
