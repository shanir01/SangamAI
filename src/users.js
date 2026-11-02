"use strict";

// Multi-user API keys with a daily token quota, stored in one JSON file (users.json).
// Keys look like "sk-flr-...". Only a SHA-256 hash of each key is saved, so a leaked
// users.json does not leak working keys. The full key is shown once, when it is created
// (or regenerated).
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { utcDay } = require("./buckets");

const KEY_PREFIX = "sk-flr-";

function hashKey(key) {
  return crypto.createHash("sha256").update(String(key)).digest("hex");
}

function newKey() {
  return KEY_PREFIX + crypto.randomBytes(24).toString("base64url");
}

class UserStore {
  constructor({ file = null, now = Date.now, defaultQuota = 50000, log } = {}) {
    this.file = file;
    this.now = now;
    this.defaultQuota = defaultQuota;
    this.log = log || { warn() {} };
    this.users = []; // {id, name, email, key_hash, key_hint, quota_tokens_per_day, enabled, created_at, via, last_used_at, usage:{day:{requests,tokens}}}
    this.signups = {}; // { "<ip>|<day>": count }
    this._load();
  }

  _load() {
    if (!this.file) return;
    try {
      const j = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (Array.isArray(j.users)) this.users = j.users;
      if (j.signups && typeof j.signups === "object") this.signups = j.signups;
    } catch {
      /* no file yet, or unreadable: start empty */
    }
  }

  save() {
    if (!this.file) return;
    try {
      fs.mkdirSync(path.dirname(path.resolve(this.file)), { recursive: true });
      const tmp = this.file + ".tmp";
      fs.writeFileSync(
        tmp,
        JSON.stringify({ version: 1, users: this.users, signups: this.signups }, null, 2),
      );
      fs.renameSync(tmp, this.file);
    } catch (e) {
      this.log.warn("users file save failed", { error: String(e.message) });
    }
  }

  count() {
    return this.users.length;
  }

  _today(u) {
    const d = utcDay(this.now());
    u.usage = u.usage || {};
    // keep only the last 14 days per user
    const days = Object.keys(u.usage).sort();
    while (days.length > 14) delete u.usage[days.shift()];
    return (u.usage[d] = u.usage[d] || { requests: 0, tokens: 0 });
  }

  /** Public view (never includes the hash). */
  view(u) {
    const t = this._today(u);
    return {
      id: u.id,
      name: u.name,
      email: u.email || null,
      key_hint: u.key_hint,
      enabled: u.enabled,
      quota_tokens_per_day: u.quota_tokens_per_day,
      used_tokens_today: t.tokens,
      requests_today: t.requests,
      remaining_tokens_today: Math.max(0, u.quota_tokens_per_day - t.tokens),
      created_at: u.created_at,
      last_used_at: u.last_used_at || null,
      via: u.via || "admin",
    };
  }

  list() {
    return this.users.map((u) => this.view(u));
  }

  get(id) {
    return this.users.find((u) => u.id === id) || null;
  }

  /** Create a user; returns { user (view), key } — the only time the full key is visible. */
  create({ name, email, quota, enabled = true, via = "admin" } = {}) {
    const key = newKey();
    const q = Number.isFinite(Number(quota)) && Number(quota) > 0 ? Math.floor(Number(quota)) : this.defaultQuota;
    const u = {
      id: "u_" + crypto.randomBytes(5).toString("hex"),
      name: String(name || "user").slice(0, 60),
      email: email ? String(email).slice(0, 120) : null,
      key_hash: hashKey(key),
      key_hint: key.slice(0, 11) + "…" + key.slice(-4),
      quota_tokens_per_day: q,
      enabled: Boolean(enabled),
      created_at: new Date(this.now()).toISOString(),
      via,
      usage: {},
    };
    this.users.push(u);
    this.save();
    return { user: this.view(u), key };
  }

  update(id, patch = {}) {
    const u = this.get(id);
    if (!u) return null;
    if (patch.name !== undefined) u.name = String(patch.name).slice(0, 60);
    if (patch.email !== undefined) u.email = patch.email ? String(patch.email).slice(0, 120) : null;
    if (patch.enabled !== undefined) u.enabled = Boolean(patch.enabled);
    if (patch.quota_tokens_per_day !== undefined) {
      const q = Math.floor(Number(patch.quota_tokens_per_day));
      if (!Number.isFinite(q) || q < 0) throw new Error("quota_tokens_per_day must be a number >= 0");
      u.quota_tokens_per_day = q;
    }
    if (patch.reset_today) this._today(u).tokens = 0;
    this.save();
    return this.view(u);
  }

  regenerate(id) {
    const u = this.get(id);
    if (!u) return null;
    const key = newKey();
    u.key_hash = hashKey(key);
    u.key_hint = key.slice(0, 11) + "…" + key.slice(-4);
    this.save();
    return { user: this.view(u), key };
  }

  remove(id) {
    const before = this.users.length;
    this.users = this.users.filter((u) => u.id !== id);
    if (this.users.length !== before) this.save();
    return this.users.length !== before;
  }

  /** Find the user for a presented key (or null). */
  findByKey(key) {
    if (!key || !String(key).startsWith(KEY_PREFIX)) return null;
    const h = hashKey(key);
    const hb = Buffer.from(h);
    for (const u of this.users) {
      const ub = Buffer.from(u.key_hash || "");
      if (ub.length === hb.length && crypto.timingSafeEqual(ub, hb)) return u;
    }
    return null;
  }

  /** Can this user make a request right now? Returns null if yes, or {status, code, message}. */
  check(u) {
    if (!u.enabled)
      return { status: 403, code: "key_disabled", message: "this API key is turned off by the admin" };
    const t = this._today(u);
    if (t.tokens >= u.quota_tokens_per_day) {
      const now = this.now();
      const next = Date.parse(utcDay(now) + "T00:00:00Z") + 86400000;
      return {
        status: 429,
        code: "daily_quota_exceeded",
        message: `daily quota over: you used ${t.tokens} of ${u.quota_tokens_per_day} tokens today. It resets at 00:00 UTC (in about ${Math.ceil((next - now) / 3600000)} h).`,
        retryAfterS: Math.ceil((next - now) / 1000),
      };
    }
    return null;
  }

  addUsage(u, tokens) {
    const t = this._today(u);
    t.requests += 1;
    t.tokens += Math.max(0, Math.round(Number(tokens) || 0));
    u.last_used_at = new Date(this.now()).toISOString();
    this.save();
  }

  /** Signup throttle: max `perIpPerDay` keys per IP per UTC day. */
  allowSignup(ip, perIpPerDay = 2) {
    const d = utcDay(this.now());
    for (const k of Object.keys(this.signups)) if (!k.endsWith("|" + d)) delete this.signups[k];
    const k = ip + "|" + d;
    if ((this.signups[k] || 0) >= perIpPerDay) return false;
    this.signups[k] = (this.signups[k] || 0) + 1;
    return true;
  }

  exportAll() {
    return { version: 1, exported_at: new Date(this.now()).toISOString(), users: this.users };
  }

  importAll(data) {
    if (!data || !Array.isArray(data.users)) throw new Error("expected { users: [...] } from an export");
    for (const u of data.users) {
      if (!u.id || !u.key_hash) throw new Error("bad user entry in import");
    }
    this.users = data.users;
    this.save();
    return this.users.length;
  }
}

module.exports = { UserStore, hashKey, newKey, KEY_PREFIX };
