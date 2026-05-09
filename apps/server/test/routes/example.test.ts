import { expect, test } from "bun:test";

import { build } from "../helper";

test("example is loaded", async () => {
  const app = await build();

  try {
    const res = await app.inject({
      url: "/example",
    });

    expect(res.payload).toBe("this is an example");
  } finally {
    await app.close();
  }
});
