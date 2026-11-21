const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/font.js");
function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end(data) {
      this.body = data;
      return this;
    },
  };
}
test("font endpoint rejects mutations and unknown families before fetching", async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    throw new Error("unexpected fetch");
  };
  try {
    for (const request of [
      { method: "POST", query: { family: "Montserrat" } },
      { method: "GET", query: { family: "https://untrusted.example/font" } },
      { method: "GET", query: { family: "Montserrat", weight: "9999" } },
      { method: "GET", query: { family: ["Montserrat", "Lora"] } },
    ]) {
      const res = response();
      await handler(request, res);
      assert([400, 405].includes(res.statusCode));
    }
    assert.equal(calls, 0);
  } finally {
    global.fetch = original;
  }
});
test("font bytes are selected from the allowed origin and retain a license link", async () => {
  const original = global.fetch,
    calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (calls.length === 1)
      return new Response(
        "@font-face {src:url(https://fonts.gstatic.com/cyrillic.woff2)} @font-face {src:url(https://fonts.gstatic.com/latin.woff2)}",
      );
    return new Response(Buffer.from("wOF2-test"), {
      headers: { "content-type": "font/woff2" },
    });
  };
  try {
    const res = response();
    await handler(
      { method: "GET", query: { family: "Montserrat", weight: "400" } },
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(calls[1], "https://fonts.gstatic.com/latin.woff2");
    assert.equal(res.body.toString(), "wOF2-test");
    assert.match(res.headers.link, /license=1/);
    assert.match(res.headers["cache-control"], /public/);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  } finally {
    global.fetch = original;
  }
});
test("an unexpected upstream font origin cannot trigger a second request", async () => {
  const original = global.fetch,
    originalError = console.error;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return new Response(
      "@font-face {src:url(https://untrusted.example/font.woff2)}",
    );
  };
  console.error = () => {};
  try {
    const res = response();
    await handler({ method: "GET", query: { family: "Montserrat" } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(calls, 1);
    assert.equal(res.headers["cache-control"], "no-store");
  } finally {
    global.fetch = original;
    console.error = originalError;
  }
});
test("license requests use the public font repository", async () => {
  const original = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    return new Response("SIL OPEN FONT LICENSE");
  };
  try {
    const res = response();
    await handler(
      { method: "GET", query: { family: "Montserrat", license: "1" } },
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, "SIL OPEN FONT LICENSE");
    assert.equal(
      calls[0],
      "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/OFL.txt",
    );
  } finally {
    global.fetch = original;
  }
});
