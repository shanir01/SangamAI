#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Router, RouterError } = require("./router");
const { makeRedactor, createLogger } = require("./redact");
const { pipeStream } = require("./stream");
const { loadEnvFile } = require("./env");
const { UserStore } = require("./users");
const { makeCloudSave } = require("./cloudsave");

const ROOT = path.resolve(__dirname, "..");
const DASHBOARD_FILE = path.join(ROOT, "public", "dashboard.html");
const SIGNUP_FILE = path.join(ROOT, "public", "signup.html");
const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v || "").trim());

// Where each provider's free key is made (shown on the setup page).
const KEY_LINKS = {
  gemini: "https://aistudio.google.com/apikey",
  groq: "https://console.groq.com/keys",
  openrouter: "https://openrouter.ai/keys",
  mistral: "https://console.mistral.ai/api-keys",
  cerebras: "https://cloud.cerebras.ai",
  huggingface: "https://huggingface.co/settings/tokens",
};
const KEY_NOTES = {
  gemini: "Free tier",
  groq: "Free plan",
  openrouter: "Free :free models (50 requests/day per account)",
  mistral: "Free mode",
  cerebras: "Trial only: $5 credits, 30 days",
  huggingface: "Needs PRO or paid credits (off by default)",
};

/** Keys pasted on the setup page are kept in a small local JSON file (never uploaded). */
function readKeysFile(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}
function writeKeysFile(file, obj) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function sendFile(res, file, fallback) {
  let html;
  try {
    html = fs.readFileSync(file);
  } catch {
    html = Buffer.from(fallback);
  }
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-length": html.length,
    "cache-control": "no-store",
  });
  res.end(html);
}

function bearer(req) {
  const auth = String(req.headers.authorization || "");
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, "").trim();
  return String(req.headers["x-api-key"] || "").trim();
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.socket.remoteAddress || "unknown";
}

function isLoopback(req) {
  const a = String(req.socket.remoteAddress || "");
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}

const MAX_BODY = 10 * 1024 * 1024;

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function parseArgs(argv, env = process.env) {
  // On hosts like Render the platform sets PORT; then we must listen on 0.0.0.0.
  const hosted = Boolean(env.PORT);
  const opts = {
    port: Number(env.PORT || 8787),
    host: env.HOST || (hosted ? "0.0.0.0" : "127.0.0.1"),
    config: env.CONFIG_FILE || "router.config.json",
    state: env.STATE_FILE || null,
    help: false,
    insecure: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--port") opts.port = Number(next());
    else if (a === "--host") opts.host = next();
    else if (a === "--insecure") opts.insecure = true;
    else if (a === "--config") opts.config = next();
    else if (a === "--state") opts.state = next();
    else if (a === "--help" || a === "-h") opts.help = true;
    else throw new Error(`unknown option: ${a}`);
  }
  if (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535)
    throw new Error("--port must be 0-65535");
  return opts;
}

const HELP = `FreeLLM-Router - one OpenAI-compatible API over many free-tier LLM APIs

Usage: node src/server.js [--port 8787] [--host 127.0.0.1] [--config router.config.json] [--state router.state.json] [--insecure]

Keys come from a .env file or environment variables (GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY,
MISTRAL_API_KEY, CEREBRAS_API_KEY, HF_TOKEN). MASTER_KEY protects the endpoint: clients send
"Authorization: Bearer <MASTER_KEY>". Env PORT / HOST / CONFIG_FILE / STATE_FILE override the defaults.
There is intentionally no flag to allow paid models.`;

function loadConfig(file) {
  // Fall back to the example config so a fresh clone runs without copying anything.
  if (!fs.existsSync(file)) {
    const example = path.join(path.dirname(file), "router.config.example.json");
    const rootExample = path.join(ROOT, "router.config.example.json");
    if (fs.existsSync(example)) file = example;
    else if (fs.existsSync(rootExample)) file = rootExample;
  }
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new Error(
      `cannot read config ${file}: ${e.message} (copy router.config.example.json to router.config.json)`,
    );
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`config ${file} is not valid JSON: ${e.message}`);
  }
}

function collectSecrets(config, env) {
  const names = new Set(["ROUTER_TOKEN", "MASTER_KEY", "ADMIN_PASSWORD", "HF_TOKEN", "GITHUB_TOKEN"]);
  for (const [n, p] of Object.entries(config.providers || {})) {
    if (p && p.api_key_env) names.add(p.api_key_env);
    names.add(n.toUpperCase() + "_API_KEY");
  }
  return [...names].map((n) => env[n]).filter(Boolean);
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-api-key, x-admin-password",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-expose-headers": "x-router-provider, x-router-model, x-quota-remaining",
};

function sendJson(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
    ...CORS,
    ...headers,
  });
  res.end(body);
}

function errorBody(code, message, extra) {
  return { error: { message, type: code, code, ...(extra || {}) } };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(
          new RouterError(413, "body_too_large", "request body too large"),
        );
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Build the HTTP server + router. Pure factory so tests can run it on port 0 with mock upstreams. */
function createApp({
  config,
  env = process.env,
  now = Date.now,
  out,
  fetchImpl,
  stateFile,
  usersFile,
  keysFile,
  lockedEnv = [],
} = {}) {
  const redact = makeRedactor(collectSecrets(config, env));
  const logger = createLogger({ out, redact });
  const router = new Router({
    config,
    env,
    now,
    fetchImpl,
    redact,
    logger,
    stateFile,
  });
  const token = env.MASTER_KEY || env.ROUTER_TOKEN || null;
  const adminPass = env.ADMIN_PASSWORD || token || null;
  const serverMode = truthy(env.SERVER_MODE);
  const signupEnabled = serverMode && truthy(env.ENABLE_SIGNUP);
  const locked = new Set(lockedEnv); // keys set by the real environment (e.g. Render): not editable from the UI
  const maxUsers = Number(env.MAX_USERS) || 200;
  const users = new UserStore({
    file: usersFile || null,
    now,
    defaultQuota: Number(env.DEFAULT_USER_QUOTA) || 50000,
    log: logger,
  });

  /** Who is calling the API? -> {role:"owner"} | {role:"user", user} | null */
  function identify(req) {
    const presented = bearer(req);
    if (presented) {
      if (token && safeEqual(presented, token)) return { role: "owner" };
      if (env.ADMIN_PASSWORD && safeEqual(presented, env.ADMIN_PASSWORD))
        return { role: "owner" };
      const u = serverMode ? users.findByKey(presented) : null;
      if (u) return { role: "user", user: u };
    }
    // No MASTER_KEY and no user keys yet: local, unprotected mode (only allowed on 127.0.0.1).
    if (!token && (!serverMode || users.count() === 0)) return { role: "owner" };
    return null;
  }

  function isAdmin(req) {
    const presented =
      String(req.headers["x-admin-password"] || "").trim() || bearer(req);
    if (adminPass) return Boolean(presented) && safeEqual(presented, adminPass);
    return isLoopback(req); // nothing configured: only this computer may open the admin API
  }

  async function readJson(req) {
    const raw = await readBody(req);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      // HTML form post fallback: name=..&email=..
      return Object.fromEntries(new URLSearchParams(raw));
    }
  }

  async function handleAdmin(req, res, url) {
    if (!isAdmin(req))
      return sendJson(res, 401, errorBody("unauthorized", "wrong or missing admin password"));
    if (url.pathname === "/admin/api/keys" && req.method === "GET") {
      const saved = keysFile ? readKeysFile(keysFile) : {};
      const list = [...router.providers.values()].map((p) => {
        const v = env[p.api_key_env] || "";
        return {
          provider: p.name,
          env: p.api_key_env,
          set: Boolean(v),
          hint: v ? v.slice(0, 4) + "…" + v.slice(-4) : null,
          source: !v ? null : locked.has(p.api_key_env) ? "environment" : saved[p.api_key_env] ? "setup page" : ".env",
          editable: !locked.has(p.api_key_env),
          link: KEY_LINKS[p.name] || null,
          note: KEY_NOTES[p.name] || "",
          free_models: [...router.models.values()].filter((st) => st.cfg.provider === p.name && st.free).length,
        };
      });
      return sendJson(res, 200, { keys: list, keys_file: Boolean(keysFile) });
    }
    if (url.pathname === "/admin/api/keys" && req.method === "POST") {
      // body: { "GROQ_API_KEY": "gsk_...", "GEMINI_API_KEY": "" (empty = remove) }
      if (!keysFile) return sendJson(res, 400, errorBody("no_keys_file", "this server has no local keys file"));
      const b = await readJson(req);
      const allowed = new Set([...router.providers.values()].map((p) => p.api_key_env));
      const saved = readKeysFile(keysFile);
      const changed = [];
      for (const [k, v] of Object.entries(b || {})) {
        if (!allowed.has(k)) continue;
        if (locked.has(k)) continue;
        const val = String(v || "").trim();
        if (val) {
          saved[k] = val;
          env[k] = val;
        } else {
          delete saved[k];
          delete env[k];
        }
        redact.add(val);
        changed.push(k);
        // a new key gets a fresh start: clear cooldowns of that provider's models
        for (const st of router.models.values()) {
          const pv = router.providers.get(st.cfg.provider);
          if (pv && pv.api_key_env === k) {
            st.cooldownUntil = 0;
            st.fails = 0;
          }
        }
      }
      writeKeysFile(keysFile, saved);
      logger.info("keys saved from setup page", { changed });
      return sendJson(res, 200, { ok: true, changed });
    }
    if (url.pathname === "/admin/api/keys/test" && req.method === "POST") {
      const b = await readJson(req);
      const p = router.providers.get(String(b.provider || ""));
      if (!p) return sendJson(res, 404, errorBody("not_found", "unknown provider"));
      const key = String(b.key || "").trim() || env[p.api_key_env];
      if (!key) return sendJson(res, 200, { ok: false, message: "no key to test" });
      try {
        const r = await (fetchImpl || globalThis.fetch)(p.base_url + "/models", {
          headers: { ...p.adapter.headers(key), accept: "application/json" },
          signal: AbortSignal.timeout(15000),
        });
        const text = r.ok ? "" : redact((await r.text()).slice(0, 200));
        return sendJson(res, 200, {
          ok: r.ok,
          status: r.status,
          message: r.ok ? "key works ✓" : `provider answered ${r.status}: ${text}`,
        });
      } catch (e) {
        return sendJson(res, 200, { ok: false, message: "could not reach provider: " + redact(e.message) });
      }
    }
    if (url.pathname.startsWith("/admin/api/users") || url.pathname.startsWith("/admin/api/export") || url.pathname.startsWith("/admin/api/import")) {
      if (!serverMode)
        return sendJson(res, 403, errorBody("server_mode_off", "user keys are part of server mode. Set SERVER_MODE=true in .env and restart."));
    }
    const m = url.pathname.match(/^\/admin\/api\/users(?:\/([A-Za-z0-9_]+))?(?:\/(regenerate))?$/);
    if (url.pathname === "/admin/api/stats" && req.method === "GET")
      return sendJson(res, 200, {
        ...router.stats(),
        server_mode: serverMode,
        users: { count: users.count(), signup_enabled: signupEnabled, max_users: maxUsers, default_quota: users.defaultQuota },
      });
    if (url.pathname === "/admin/api/export" && req.method === "GET")
      return sendJson(res, 200, users.exportAll(), {
        "content-disposition": 'attachment; filename="freellm-users-backup.json"',
      });
    if (url.pathname === "/admin/api/import" && req.method === "POST") {
      try {
        const n = users.importAll(await readJson(req));
        return sendJson(res, 200, { ok: true, users: n });
      } catch (e) {
        return sendJson(res, 400, errorBody("invalid_request", e.message));
      }
    }
    if (m) {
      const id = m[1];
      if (!id && req.method === "GET") return sendJson(res, 200, { users: users.list() });
      if (!id && req.method === "POST") {
        const b = await readJson(req);
        const out = users.create({ name: b.name, email: b.email, quota: b.quota_tokens_per_day, enabled: b.enabled !== false });
        return sendJson(res, 201, { ...out, note: "copy this key now; it is not shown again" });
      }
      if (id && m[2] === "regenerate" && req.method === "POST") {
        const out = users.regenerate(id);
        return out ? sendJson(res, 200, out) : sendJson(res, 404, errorBody("not_found", "no such user"));
      }
      if (id && req.method === "PATCH") {
        let v;
        try {
          v = users.update(id, await readJson(req));
        } catch (e) {
          return sendJson(res, 400, errorBody("invalid_request", e.message));
        }
        return v ? sendJson(res, 200, { user: v }) : sendJson(res, 404, errorBody("not_found", "no such user"));
      }
      if (id && req.method === "DELETE")
        return users.remove(id)
          ? sendJson(res, 200, { ok: true })
          : sendJson(res, 404, errorBody("not_found", "no such user"));
    }
    return sendJson(res, 404, errorBody("not_found", `no admin route for ${req.method} ${url.pathname}`));
  }

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, "http://localhost");
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS);
        return res.end();
      }
      if (req.method === "GET" && url.pathname === "/healthz")
        return sendJson(res, 200, { ok: true, server_mode: serverMode, signup: signupEnabled });
      if (
        req.method === "GET" &&
        (url.pathname === "/" || url.pathname === "/dashboard" || url.pathname === "/admin")
      ) {
        // The page holds no data itself; it asks for the admin password, then calls /admin/api/*.
        return sendFile(res, DASHBOARD_FILE, "<h1>FreeLLM-Router</h1><p>dashboard file missing</p>");
      }
      if (url.pathname === "/signup") {
        if (!signupEnabled)
          return sendJson(res, 404, errorBody("signup_disabled", "public signup is turned off on this server (needs SERVER_MODE=true and ENABLE_SIGNUP=true)"));
        if (req.method === "GET")
          return sendFile(res, SIGNUP_FILE, "<h1>Signup</h1><p>signup page missing</p>");
        if (req.method === "POST") {
          const b = await readJson(req);
          const name = String(b.name || "").trim();
          if (!name) return sendJson(res, 400, errorBody("invalid_request", "name is required"));
          if (users.count() >= maxUsers)
            return sendJson(res, 403, errorBody("signup_full", "this server is full right now, ask the owner"));
          if (!users.allowSignup(clientIp(req)))
            return sendJson(res, 429, errorBody("signup_rate_limited", "too many keys from your network today, try tomorrow"));
          const out = users.create({ name, email: b.email, via: "signup" });
          logger.info("signup", { user: out.user.id });
          return sendJson(res, 201, {
            key: out.key,
            quota_tokens_per_day: out.user.quota_tokens_per_day,
            note: "copy this key now; it is not shown again",
          });
        }
      }
      if (url.pathname.startsWith("/admin/api/")) return await handleAdmin(req, res, url);
      if (req.method === "GET" && url.pathname === "/stats") {
        if (!isAdmin(req) && !(token && safeEqual(bearer(req), token)))
          return sendJson(res, 401, errorBody("unauthorized", "/stats needs the admin password or MASTER_KEY"));
        return sendJson(res, 200, router.stats());
      }
      const caller = identify(req);
      if (!caller)
        return sendJson(
          res,
          401,
          errorBody(
            "unauthorized",
            "missing or wrong API key (send header: Authorization: Bearer <your key>)",
          ),
        );
      if (req.method === "GET" && url.pathname === "/v1/me") {
        if (caller.role === "owner") return sendJson(res, 200, { role: "owner", quota: "unlimited (owner)" });
        return sendJson(res, 200, { role: "user", ...users.view(caller.user) });
      }
      if (req.method === "GET" && url.pathname === "/v1/models") {
        const data = router.listAliases().map((id) => ({
          id,
          object: "model",
          created: 0,
          owned_by: "freellm-router",
          kind: "alias",
        }));
        for (const [id, st] of router.models) {
          if (!st.free) continue;
          const p = router.providers.get(st.cfg.provider);
          data.push({
            id,
            object: "model",
            created: 0,
            owned_by: st.cfg.provider,
            kind: "model",
            available: Boolean(env[p.api_key_env]),
          });
        }
        return sendJson(res, 200, { object: "list", data });
      }
      if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
        let body;
        try {
          body = JSON.parse(await readBody(req));
        } catch (e) {
          if (e instanceof RouterError) throw e;
          throw new RouterError(
            400,
            "invalid_json",
            "request body is not valid JSON",
          );
        }
        if (
          !body ||
          typeof body !== "object" ||
          !Array.isArray(body.messages)
        ) {
          throw new RouterError(
            400,
            "invalid_request",
            '"messages" array is required',
          );
        }
        if (caller.role === "user") {
          const block = users.check(caller.user);
          if (block)
            return sendJson(
              res,
              block.status,
              errorBody(block.code, block.message),
              block.retryAfterS ? { "retry-after": String(block.retryAfterS) } : {},
            );
        }
        const countFor = (usage) => {
          if (caller.role !== "user") return;
          const t = Number(usage && usage.total_tokens) ||
            (Number(usage && usage.prompt_tokens) || 0) + (Number(usage && usage.completion_tokens) || 0);
          users.addUsage(caller.user, t);
        };
        const ac = new AbortController();
        res.on("close", () => {
          if (!res.writableEnded) ac.abort();
        });
        const r = await router.handle(body, { signal: ac.signal });
        const hdrs = {
          ...CORS,
          ...(caller.role === "user"
            ? { "x-quota-remaining": String(Math.max(0, caller.user.quota_tokens_per_day - users._today(caller.user).tokens)) }
            : {}),
          "x-router-provider": r.provider,
          "x-router-model": r.upstreamModel,
        };
        if (r.stream) {
          res.writeHead(200, {
            "content-type":
              r.upstream.headers.get("content-type") || "text/event-stream",
            "cache-control": "no-cache",
            "x-accel-buffering": "no",
            ...hdrs,
          });
          try {
            const info = await pipeStream(r.upstream, res);
            if (info.usage) {
              router.recordUsage(r.provider, info.usage, false);
              countFor(info.usage);
            } else {
              const c = Math.ceil(info.contentChars / 4);
              const est = { prompt_tokens: r.estPrompt, completion_tokens: c, total_tokens: r.estPrompt + c };
              router.recordUsage(r.provider, est, true);
              countFor(est);
            }
          } catch (e) {
            logger.warn("stream aborted mid-flight", {
              provider: r.provider,
              error: e.message,
            });
          }
          res.end();
        } else {
          const buf = Buffer.from(await r.upstream.arrayBuffer());
          let usage = null;
          try {
            usage = JSON.parse(buf.toString("utf8")).usage || null;
          } catch {
            /* not JSON */
          }
          if (!usage) {
            usage = { prompt_tokens: r.estPrompt, total_tokens: r.estPrompt };
            router.recordUsage(r.provider, usage, true);
          } else router.recordUsage(r.provider, usage, false);
          countFor(usage);
          res.writeHead(200, {
            "content-type":
              r.upstream.headers.get("content-type") || "application/json",
            "content-length": buf.length,
            ...hdrs,
          });
          res.end(buf);
        }
        logger.info("served", {
          alias: r.requested,
          provider: r.provider,
          model: r.upstreamModel,
          stream: r.stream,
          ms: Date.now() - started,
        });
        return;
      }
      return sendJson(
        res,
        404,
        errorBody("not_found", `no route for ${req.method} ${url.pathname}`),
      );
    } catch (e) {
      if (res.headersSent) {
        try {
          res.end();
        } catch {
          /* ignore */
        }
        return;
      }
      if (e instanceof RouterError) {
        if (e.code === "upstream_client_error") {
          res.writeHead(e.status, {
            "content-type": "application/json",
            ...CORS,
            ...e.headers,
          });
          return res.end(
            e.message.trim().startsWith("{")
              ? e.message
              : JSON.stringify(errorBody(e.code, e.message)),
          );
        }
        return sendJson(
          res,
          e.status,
          errorBody(
            e.code,
            e.message,
            e.tried ? { tried: e.tried } : undefined,
          ),
          e.headers,
        );
      }
      logger.error("unhandled", { error: e.message });
      return sendJson(res, 500, errorBody("internal_error", "internal error"));
    }
  });
  return { server, router, logger, users };
}

async function main() {
  // Variables set by the real environment (e.g. Render's dashboard) are never overridden.
  const realEnv = new Set(Object.keys(process.env).filter((k) => process.env[k]));
  // Load .env from the current folder, then from the project folder (first one wins per key).
  const envLoaded = [
    loadEnvFile(path.resolve(".env")),
    loadEnvFile(path.join(ROOT, ".env")),
  ];
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n\n${HELP}\n`);
    process.exit(2);
  }
  if (opts.help) {
    process.stdout.write(HELP + "\n");
    return;
  }
  const configPath = path.resolve(opts.config);
  let config;
  try {
    config = loadConfig(configPath);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(2);
  }
  const stateFile = path.resolve(
    opts.state ||
      path.join(
        path.dirname(configPath),
        config.state_file || "router.state.json",
      ),
  );
  const usersFile = path.resolve(
    process.env.USERS_FILE || path.join(path.dirname(stateFile), "users.json"),
  );
  // Keys pasted on the setup page (keys.local.json) win over .env, but not over the real environment.
  const keysFile = path.resolve(process.env.KEYS_FILE || path.join(ROOT, "keys.local.json"));
  const providerEnvs = Object.entries(config.providers || {}).map(([n, pc]) => {
    try {
      return require("./providers").resolveProvider(n, pc).api_key_env;
    } catch {
      return null;
    }
  }).filter(Boolean);
  const lockedEnv = providerEnvs.filter((k) => realEnv.has(k));
  for (const [k, v] of Object.entries(readKeysFile(keysFile))) {
    if (providerEnvs.includes(k) && !realEnv.has(k) && v) process.env[k] = String(v);
  }
  const bootLog = createLogger({ redact: makeRedactor(collectSecrets(config, process.env)) });
  const cloud = makeCloudSave({ files: [usersFile, stateFile], logger: bootLog });
  if (cloud) {
    try {
      const n = await cloud.pull();
      bootLog.info("cloud save: downloaded from GitHub Gist", { files: n });
    } catch (e) {
      bootLog.warn("cloud save: could not download (starting with local files)", { error: e.message });
    }
  }
  let app;
  try {
    app = createApp({ config, stateFile, usersFile, keysFile, lockedEnv });
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(2);
  }
  if (
    opts.host !== "127.0.0.1" &&
    opts.host !== "localhost" &&
    !process.env.MASTER_KEY &&
    !process.env.ROUTER_TOKEN
  ) {
    if (!opts.insecure) {
      process.stderr.write(
        "error: refusing to listen on a public host without MASTER_KEY (anyone who finds the URL could spend your free quota). Set MASTER_KEY in .env (or in your host's Environment settings), or pass --insecure if you really mean it.\n",
      );
      process.exit(2);
    }
    app.logger.warn(
      "--insecure: listening on a public host without MASTER_KEY: anyone who can reach this port can spend your free quota",
    );
  }
  const withKey = [];
  const withoutKey = [];
  for (const [name, p] of app.router.providers) {
    (process.env[p.api_key_env] ? withKey : withoutKey).push(name);
  }
  if (envLoaded.some((e) => e.loaded))
    app.logger.info(".env loaded");
  if (!withKey.length)
    app.logger.warn(
      "no provider API keys yet: open the dashboard (Setup page) in your browser and paste a free key, or add one to .env",
    );
  else app.logger.info("providers with keys", { ready: withKey, skipped_no_key: withoutKey });
  for (const [id, st] of app.router.models) {
    const p = app.router.providers.get(st.cfg.provider);
    if (!st.free && process.env[p.api_key_env])
      app.logger.warn(
        "model is not flagged free:true and will never be called (edit router.config.json if you have credits)",
        { model: id },
      );
  }
  app.server.listen(opts.port, opts.host, () => {
    const a = app.server.address();
    app.logger.info("listening", {
      url: `http://${a.address}:${a.port}/v1`,
      dashboard: `http://${a.address === "0.0.0.0" ? "localhost" : a.address}:${a.port}/`,
      master_key: Boolean(process.env.MASTER_KEY || process.env.ROUTER_TOKEN),
      aliases: app.router.listAliases(),
      state: stateFile,
    });
  });
  if (cloud) cloud.start();
  const stop = async () => {
    app.router.persist();
    if (cloud) {
      cloud.stop();
      try {
        await cloud.push();
      } catch (e) {
        app.logger.warn("cloud save: final upload failed", { error: e.message });
      }
    }
    app.server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

if (require.main === module) main();

module.exports = { createApp, parseArgs, loadConfig, collectSecrets };
