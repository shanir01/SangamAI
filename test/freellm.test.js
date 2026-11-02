"use strict";
// Tests for the FreeLLM-Router additions: no-key errors, round-robin, 402 failover,
// token usage counters, MASTER_KEY, multi-user keys with daily quotas, signup, .env parsing.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { mockUpstream, okJson, status, makeConfig, startRouter } = require("./helpers");
const { parseEnv } = require("../src/env");

const withUsage = (text, usage) => (req, body, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({
    object: "chat.completion",
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage,
  }));
};

async function rig(handlers, { cfg = {}, env, usersFile } = {}) {
  const ups = [];
  for (const h of handlers) ups.push(await mockUpstream(h));
  const config = { ...makeConfig(ups), ...cfg };
  const router = await startRouter(config, { env, usersFile });
  return {
    ups,
    router,
    async close() {
      await router.close();
      for (const u of ups) await u.close();
    },
  };
}

const tmpFile = (name) => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "flr-")), name);

test("no API keys at all: chat answers 503 no_api_keys with a clear message, /v1/models still works", async () => {
  const r = await rig([okJson()], { env: {} });
  try {
    const res = await r.router.chat();
    assert.equal(res.status, 503);
    const j = await res.json();
    assert.equal(j.error.code, "no_api_keys");
    assert.match(j.error.message, /\.env/);
    assert.equal(r.ups[0].hits.length, 0);
    const m = await (await fetch(r.router.base + "/v1/models")).json();
    assert.equal(m.data.find((x) => x.id === "p1/m").available, false);
  } finally {
    await r.close();
  }
});

test("round-robin alias rotates the first provider on every request", async () => {
  const r = await rig([okJson("a"), okJson("b"), okJson("c")], {
    cfg: { alias_strategy: { fast: "round-robin" } },
  });
  try {
    const seen = [];
    for (let i = 0; i < 6; i++) seen.push((await r.router.chat()).headers.get("x-router-provider"));
    assert.deepEqual(seen, ["p1", "p2", "p3", "p1", "p2", "p3"]);
  } finally {
    await r.close();
  }
});

test("fallback (default) always starts at the first provider", async () => {
  const r = await rig([okJson("a"), okJson("b")]);
  try {
    for (let i = 0; i < 3; i++) assert.equal((await r.router.chat()).headers.get("x-router-provider"), "p1");
  } finally {
    await r.close();
  }
});

test("402 (out of credits) fails over to the next provider instead of passing the error through", async () => {
  const r = await rig([status(402, { error: { message: "insufficient credits" } }), okJson("p2")]);
  try {
    const res = await r.router.chat();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-router-provider"), "p2");
    assert.equal(r.router.router.stats().models["p1/m"].last_error.status, 402);
  } finally {
    await r.close();
  }
});

test("usage counter: tokens from the provider's usage field are counted per provider per day", async () => {
  const r = await rig([
    status(429, { error: { message: "slow" } }),
    withUsage("hi", { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }),
  ]);
  try {
    await (await r.router.chat()).json();
    await (await r.router.chat()).json(); // p1 still cooling down -> p2 again
    const st = r.router.router.stats();
    assert.equal(st.usage_today.p2.requests, 2);
    assert.equal(st.usage_today.p2.total_tokens, 30);
    assert.equal(st.usage_today.p1.failures, 1);
    assert.equal(st.providers.p2.status, "live");
    assert.equal(st.providers.p1.status, "cooling_down");
  } finally {
    await r.close();
  }
});

test("usage counter: a streamed answer's usage chunk is counted", async () => {
  const sse = (req, body, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n');
    res.write('data: {"choices":[],"usage":{"prompt_tokens":7,"completion_tokens":3,"total_tokens":10}}\n\n');
    res.end("data: [DONE]\n\n");
  };
  const r = await rig([sse]);
  try {
    const res = await r.router.chat({ stream: true });
    const text = await res.text();
    assert.match(text, /Hello/);
    await new Promise((x) => setTimeout(x, 50));
    assert.equal(r.router.router.stats().usage_today.p1.total_tokens, 10);
  } finally {
    await r.close();
  }
});

test("provider-wide limit (like OpenRouter's account cap) is shared by all its models", async () => {
  const ups = [await mockUpstream(okJson("x")), await mockUpstream(okJson("y"))];
  const config = makeConfig(ups);
  // both models on provider p1, which has a shared rpd of 2
  config.models[1].provider = "p1";
  config.providers.p1.limits = { rpd: 2 };
  delete config.providers.p2;
  const router = await startRouter(config);
  try {
    assert.equal((await router.chat()).status, 200);
    assert.equal((await router.chat()).status, 200);
    const third = await router.chat();
    assert.equal(third.status, 503);
    const j = await third.json();
    assert.ok(j.error.tried.every((t) => t.skipped === "provider_rpd"));
  } finally {
    await router.close();
    for (const u of ups) await u.close();
  }
});

test("MASTER_KEY: required on API routes, accepted as Bearer or x-api-key", async () => {
  const r = await rig([okJson()], { env: { P1_KEY: "test-key-aaaaaa-1", MASTER_KEY: "my-master-key-123" } });
  try {
    assert.equal((await r.router.chat()).status, 401);
    assert.equal((await r.router.chat({}, { authorization: "Bearer wrong" })).status, 401);
    assert.equal((await r.router.chat({}, { authorization: "Bearer my-master-key-123" })).status, 200);
    assert.equal((await r.router.chat({}, { "x-api-key": "my-master-key-123" })).status, 200);
    assert.equal((await fetch(r.router.base + "/v1/models")).status, 401);
    // dashboard page itself is public (it holds no data), its data API is not
    assert.equal((await fetch(r.router.base + "/")).status, 200);
    assert.equal((await fetch(r.router.base + "/admin/api/stats")).status, 401);
  } finally {
    await r.close();
  }
});

async function admin(base, method, p, body, pass = "admin-pass-1") {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", "x-admin-password": pass },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
}

test("multi-user: admin creates a key, user calls like OpenAI, tokens counted, quota over -> 429", async () => {
  const usersFile = tmpFile("users.json");
  const r = await rig([withUsage("hi", { prompt_tokens: 40, completion_tokens: 20, total_tokens: 60 })], {
    env: { P1_KEY: "test-key-aaaaaa-1", MASTER_KEY: "my-master-key-123", ADMIN_PASSWORD: "admin-pass-1", SERVER_MODE: "true" },
    usersFile,
  });
  try {
    const b = r.router.base;
    assert.equal((await admin(b, "GET", "/admin/api/users", null, "nope")).status, 401);
    const c = await admin(b, "POST", "/admin/api/users", { name: "Rahul", quota_tokens_per_day: 100 });
    assert.equal(c.status, 201);
    assert.match(c.json.key, /^sk-flr-/);
    const key = c.json.key;
    // the full key is never stored or listed
    assert.ok(!fs.readFileSync(usersFile, "utf8").includes(key));
    const list = await admin(b, "GET", "/admin/api/users");
    assert.ok(!JSON.stringify(list.json).includes(key));

    const auth = { authorization: "Bearer " + key };
    const r1 = await r.router.chat({}, auth);
    assert.equal(r1.status, 200);
    assert.equal(r1.headers.get("x-quota-remaining"), "100");
    await r1.json();
    const me = await (await fetch(b + "/v1/me", { headers: auth })).json();
    assert.equal(me.used_tokens_today, 60);
    assert.equal(me.remaining_tokens_today, 40);
    assert.equal((await (await r.router.chat({}, auth)).json()).object, "chat.completion"); // 120 used now
    const over = await r.router.chat({}, auth);
    assert.equal(over.status, 429);
    const oj = await over.json();
    assert.equal(oj.error.code, "daily_quota_exceeded");
    assert.match(oj.error.message, /daily quota over/);
    assert.ok(Number(over.headers.get("retry-after")) > 0);
    assert.equal(r.ups[0].hits.length, 2); // the over-quota call never reached a provider

    // admin raises the quota -> works again; turns the key off -> 403
    const id = c.json.user.id;
    assert.equal((await admin(b, "PATCH", "/admin/api/users/" + id, { quota_tokens_per_day: 1000 })).status, 200);
    assert.equal((await r.router.chat({}, auth)).status, 200);
    await admin(b, "PATCH", "/admin/api/users/" + id, { enabled: false });
    const off = await r.router.chat({}, auth);
    assert.equal(off.status, 403);
    assert.equal((await off.json()).error.code, "key_disabled");
    // regenerate: old key dies, new key works
    await admin(b, "PATCH", "/admin/api/users/" + id, { enabled: true });
    const rg = await admin(b, "POST", "/admin/api/users/" + id + "/regenerate");
    assert.equal((await r.router.chat({}, auth)).status, 401);
    assert.equal((await r.router.chat({}, { authorization: "Bearer " + rg.json.key })).status, 200);
    // owner's MASTER_KEY has no quota
    assert.equal((await r.router.chat({}, { authorization: "Bearer my-master-key-123" })).status, 200);
    // export / import round trip, delete
    const ex = await admin(b, "GET", "/admin/api/export");
    assert.equal(ex.json.users.length, 1);
    assert.equal((await admin(b, "DELETE", "/admin/api/users/" + id)).status, 200);
    assert.equal((await r.router.chat({}, { authorization: "Bearer " + rg.json.key })).status, 401);
    assert.equal((await admin(b, "POST", "/admin/api/import", ex.json)).status, 200);
    assert.equal((await r.router.chat({}, { authorization: "Bearer " + rg.json.key })).status, 200);
  } finally {
    await r.close();
  }
});

test("users survive a restart (users.json)", async () => {
  const usersFile = tmpFile("users.json");
  const env = { P1_KEY: "test-key-aaaaaa-1", MASTER_KEY: "m-key-123456", ADMIN_PASSWORD: "admin-pass-1", SERVER_MODE: "true" };
  const a = await rig([okJson()], { env, usersFile });
  const c = await admin(a.router.base, "POST", "/admin/api/users", { name: "Asha" });
  assert.equal(c.json.user.quota_tokens_per_day, 50000); // default quota
  await a.close();
  const b = await rig([okJson()], { env, usersFile });
  try {
    assert.equal((await b.router.chat({}, { authorization: "Bearer " + c.json.key })).status, 200);
  } finally {
    await b.close();
  }
});

test("public signup: off by default (404); when on, issues a key with the default quota and is rate limited per IP", async () => {
  const off = await rig([okJson()], { env: { P1_KEY: "k-aaaaaaaa", MASTER_KEY: "m-key-123456" } });
  try {
    assert.equal((await fetch(off.router.base + "/signup")).status, 404);
  } finally {
    await off.close();
  }
  const on = await rig([okJson()], {
    env: { P1_KEY: "k-aaaaaaaa", MASTER_KEY: "m-key-123456", SERVER_MODE: "true", ENABLE_SIGNUP: "true", DEFAULT_USER_QUOTA: "20000" },
    usersFile: tmpFile("users.json"),
  });
  try {
    const b = on.router.base;
    assert.equal((await fetch(b + "/signup")).status, 200);
    const post = (body) => fetch(b + "/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await post({})).status, 400);
    const s1 = await post({ name: "Ravi" });
    assert.equal(s1.status, 201);
    const j1 = await s1.json();
    assert.equal(j1.quota_tokens_per_day, 20000);
    assert.equal((await on.router.chat({}, { authorization: "Bearer " + j1.key })).status, 200);
    assert.equal((await post({ name: "Ravi2" })).status, 201);
    assert.equal((await post({ name: "Ravi3" })).status, 429); // 2 per IP per day
  } finally {
    await on.close();
  }
});

test(".env parser handles comments, quotes, export and Windows line endings", () => {
  const e = parseEnv('# c\r\nA=1\r\nexport B="two words"\nC=\'x#y\'\nD=val # comment\n\nBAD LINE\n');
  assert.deepEqual(e, { A: "1", B: "two words", C: "x#y", D: "val" });
});

test("cloud save: downloads users/state from a Gist at start and uploads changes", async () => {
  const { makeCloudSave } = require("../src/cloudsave");
  const gist = { "users.json": { content: '{"version":1,"users":[]}' } };
  const patches = [];
  const up = await mockUpstream((req, body, res) => {
    if (req.method === "PATCH") {
      patches.push(body);
      for (const [k, v] of Object.entries(body.files)) gist[k] = v;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ files: gist }));
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flr-cs-"));
  const usersFile = path.join(dir, "users.json");
  const stateFile = path.join(dir, "router.state.json");
  try {
    const cs = makeCloudSave({
      env: { GIST_ID: "abc", GITHUB_TOKEN: "ghp_test_token_123", GITHUB_API_URL: up.url },
      files: [usersFile, stateFile],
      logger: { warn() {} },
    });
    assert.equal(await cs.pull(), 1);
    assert.equal(fs.readFileSync(usersFile, "utf8"), '{"version":1,"users":[]}');
    assert.equal(await cs.push(), 0); // nothing changed yet
    fs.writeFileSync(usersFile, '{"version":1,"users":[{"id":"u_1"}]}');
    fs.writeFileSync(stateFile, '{"version":2,"models":{}}');
    assert.equal(await cs.push(), 2);
    assert.equal(up.hits.at(-1).headers.authorization, "Bearer ghp_test_token_123");
    assert.match(gist["users.json"].content, /u_1/);
    assert.equal(await cs.push(), 0);
    assert.equal(makeCloudSave({ env: {}, files: [], logger: {} }), null); // off without GIST_ID/GITHUB_TOKEN
  } finally {
    await up.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("setup page API: keys pasted in the browser are saved locally and work at once; env keys stay locked", async () => {
  const keysFile = tmpFile("keys.local.json");
  const up = await mockUpstream(okJson("after-setup"));
  const config = makeConfig([up]);
  const env = {};
  const { createApp } = require("../src/server");
  const app = createApp({ config, env, out: () => {}, keysFile, lockedEnv: [] });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const chat = () => fetch(base + "/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: "fast", messages: [{ role: "user", content: "hi" }] }) });
  try {
    assert.equal((await chat()).status, 503); // no key yet
    const k0 = await (await fetch(base + "/admin/api/keys")).json(); // localhost + nothing configured = allowed
    assert.equal(k0.keys[0].set, false);
    const save = await fetch(base + "/admin/api/keys", { method: "POST", body: JSON.stringify({ P1_KEY: "pasted-key-123456", EVIL: "x" }) });
    assert.deepEqual((await save.json()).changed, ["P1_KEY"]);
    assert.equal(JSON.parse(fs.readFileSync(keysFile, "utf8")).P1_KEY, "pasted-key-123456");
    const r = await chat();
    assert.equal(r.status, 200);
    assert.equal(up.hits.at(-1).headers.authorization, "Bearer pasted-key-123456");
    const k1 = await (await fetch(base + "/admin/api/keys")).json();
    assert.equal(k1.keys[0].source, "setup page");
    assert.ok(!JSON.stringify(k1).includes("pasted-key-123456")); // only a hint is shown
    const t = await (await fetch(base + "/admin/api/keys/test", { method: "POST", body: JSON.stringify({ provider: "p1" }) })).json();
    assert.equal(t.ok, true);
  } finally {
    app.server.closeAllConnections?.();
    await new Promise((r) => app.server.close(r));
    await up.close();
  }
  // a key from the real environment cannot be changed from the browser
  const app2 = createApp({ config, env: { P1_KEY: "from-render-env-1" }, out: () => {}, keysFile, lockedEnv: ["P1_KEY"] });
  await new Promise((r) => app2.server.listen(0, "127.0.0.1", r));
  const b2 = `http://127.0.0.1:${app2.server.address().port}`;
  try {
    const s = await (await fetch(b2 + "/admin/api/keys", { method: "POST", body: JSON.stringify({ P1_KEY: "other" }) })).json();
    assert.deepEqual(s.changed, []);
    const k = await (await fetch(b2 + "/admin/api/keys")).json();
    assert.equal(k.keys[0].editable, false);
    assert.equal(k.keys[0].source, "environment");
  } finally {
    app2.server.closeAllConnections?.();
    await new Promise((r) => app2.server.close(r));
  }
});

test("server mode off (default): user keys are refused and the users API says how to turn it on", async () => {
  const r = await rig([okJson()], { env: { P1_KEY: "k-aaaaaaaa", MASTER_KEY: "m-key-123456", ADMIN_PASSWORD: "admin-pass-1" } });
  try {
    const res = await admin(r.router.base, "POST", "/admin/api/users", { name: "X" });
    assert.equal(res.status, 403);
    assert.equal(res.json.error.code, "server_mode_off");
  } finally {
    await r.close();
  }
});
