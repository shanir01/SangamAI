"use strict";

// Tiny .env loader (no dependencies). Reads KEY=value lines from a file and puts them
// into process.env, without overwriting variables that are already set (so the
// hosting dashboard, e.g. Render, always wins over a local file).
const fs = require("node:fs");

function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    } else {
      const hash = v.indexOf(" #");
      if (hash >= 0) v = v.slice(0, hash);
      v = v.trim();
    }
    out[m[1]] = v;
  }
  return out;
}

function loadEnvFile(file, env = process.env) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return { loaded: false, keys: [] };
  }
  const parsed = parseEnv(text);
  const keys = [];
  for (const [k, v] of Object.entries(parsed)) {
    if (env[k] === undefined || env[k] === "") {
      if (v !== "") {
        env[k] = v;
        keys.push(k);
      }
    }
  }
  return { loaded: true, keys };
}

module.exports = { parseEnv, loadEnvFile };
