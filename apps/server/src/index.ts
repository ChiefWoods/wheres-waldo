import Fastify from "fastify";

import app from "./app.ts";

const server = Fastify({
  logger: true,
});

await server.register(app);

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

await server.listen({ host, port });
