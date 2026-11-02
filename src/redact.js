"use strict";

const PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+\/=-]{8,}/gi,
  /\bgsk_[A-Za-z0-9]{8,}/g,
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /\bcsk-[A-Za-z0-9_-]{8,}/g,
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{8,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{8,}/g,
  /\bhf_[A-Za-z0-9]{8,}/g,
  /([?&]key=)[^&\s"']+/gi,
];

/** Build a function that strips known secret values and common key shapes from a string. */
function makeRedactor(secrets = []) {
  const literals = secrets.filter(
    (s) => typeof s === "string" && s.length >= 6,
  );
  function redact(input) {
    let s = typeof input === "string" ? input : String(input);
    for (const lit of literals) s = s.split(lit).join("[REDACTED]");
    for (const re of PATTERNS) {
      s = s.replace(re, (m, g1) => (g1 ? g1 + "[REDACTED]" : "[REDACTED]"));
    }
    return s;
  }
  /** Add a secret learned at runtime (e.g. a key pasted on the setup page). */
  redact.add = (secret) => {
    if (typeof secret === "string" && secret.length >= 6 && !literals.includes(secret)) literals.push(secret);
  };
  return redact;
}

/** Structured logger; every line passes through the redactor before it is written. */
function createLogger({ out, redact } = {}) {
  const write = out || ((line) => process.stderr.write(line + "\n"));
  const r = redact || ((s) => s);
  function emit(level, msg, data) {
    let line = `${new Date().toISOString()} ${level} ${msg}`;
    if (data !== undefined) {
      try {
        line += " " + JSON.stringify(data);
      } catch {
        line += " [unserializable]";
      }
    }
    write(r(line));
  }
  return {
    info: (m, d) => emit("INFO", m, d),
    warn: (m, d) => emit("WARN", m, d),
    error: (m, d) => emit("ERROR", m, d),
  };
}

module.exports = { makeRedactor, createLogger };
