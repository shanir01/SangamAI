"use strict";

// Per-provider daily usage counter: requests, failures and tokens, kept for the last
// `keepDays` UTC days. Saved inside the router's JSON state file (no database needed,
// works the same on Windows, Termux and Render).
const { utcDay } = require("./buckets");

class UsageStore {
  constructor(now = Date.now, keepDays = 14) {
    this.now = now;
    this.keepDays = keepDays;
    this.days = {}; // { "2026-11-02": { groq: {requests, failures, prompt_tokens, completion_tokens, total_tokens, estimated_tokens} } }
  }

  _bucket(provider) {
    const d = utcDay(this.now());
    const day = (this.days[d] = this.days[d] || {});
    return (day[provider] = day[provider] || {
      requests: 0,
      failures: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      estimated_tokens: 0,
    });
  }

  _prune() {
    const keys = Object.keys(this.days).sort();
    while (keys.length > this.keepDays) delete this.days[keys.shift()];
  }

  recordFailure(provider) {
    this._bucket(provider).failures += 1;
    this._prune();
  }

  /** usage = OpenAI-style {prompt_tokens, completion_tokens, total_tokens}; estimated=true when we had to guess. */
  recordSuccess(provider, usage, estimated = false) {
    const b = this._bucket(provider);
    b.requests += 1;
    const p = Number(usage && usage.prompt_tokens) || 0;
    const c = Number(usage && usage.completion_tokens) || 0;
    const t = Number(usage && usage.total_tokens) || p + c;
    b.prompt_tokens += p;
    b.completion_tokens += c;
    b.total_tokens += t;
    if (estimated) b.estimated_tokens += t;
    this._prune();
  }

  today() {
    return this.days[utcDay(this.now())] || {};
  }

  totals(days = 7) {
    const keys = Object.keys(this.days).sort().slice(-days);
    const out = {};
    for (const k of keys) {
      for (const [prov, b] of Object.entries(this.days[k])) {
        const o = (out[prov] = out[prov] || { requests: 0, failures: 0, total_tokens: 0 });
        o.requests += b.requests;
        o.failures += b.failures;
        o.total_tokens += b.total_tokens;
      }
    }
    return out;
  }

  toJSON() {
    return this.days;
  }

  load(saved) {
    if (saved && typeof saved === "object") this.days = { ...saved };
    this._prune();
  }
}

module.exports = { UsageStore };
