import { expect, test } from "bun:test";

import { build } from "../helper";

test("default root route", async () => {
  const app = await build();

  try {
    const res = await app.inject({
      url: "/",
    });
    expect(JSON.parse(res.payload)).toEqual({ root: true });
  } finally {
    await app.close();
  }
});
