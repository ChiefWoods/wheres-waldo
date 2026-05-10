import { expect, test } from "bun:test";

import { build } from "../helper";

test("health route returns ok", async () => {
  const app = await build();

  try {
    const res = await app.inject({
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ status: "ok" });
  } finally {
    await app.close();
  }
});
