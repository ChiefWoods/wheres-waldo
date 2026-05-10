import cors from "@fastify/cors";
import fp from "fastify-plugin";

export default fp(async (fastify) => {
  const origin = process.env.CORS_ORIGIN;

  fastify.register(cors, {
    origin: origin ? origin.split(",").map((o) => o.trim()) : true,
    credentials: true,
  });
});
