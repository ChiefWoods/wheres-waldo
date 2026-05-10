FROM oven/bun:1.3.13 AS development-dependencies-env
ENV NODE_ENV=development
COPY . /
WORKDIR /
RUN bun ci

FROM oven/bun:1.3.13 AS build-env
COPY . /
COPY --from=development-dependencies-env /node_modules /node_modules
WORKDIR /apps/server
ENV DATABASE_URL=file:./data/dev.db
RUN bun run db:generate
WORKDIR /apps/web
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN bun run build

FROM nginx:alpine
COPY --from=build-env /apps/web/dist /usr/share/nginx/html
COPY --from=build-env /apps/web/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
