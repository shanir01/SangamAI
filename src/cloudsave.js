"use strict";

// Optional "cloud save" for free hosts with a temporary disk (Render free loses local files
// every time it sleeps, restarts or redeploys). If GIST_ID and GITHUB_TOKEN are set, the
// router keeps a copy of users.json and router.state.json in one PRIVATE GitHub Gist:
//  - at startup it downloads them (before the router reads them)
//  - while running it uploads them when they changed (every SYNC_SECONDS, default 60)
//  - on shutdown (SIGTERM) it uploads one last time
// Zero dependencies: plain fetch to api.github.com.
const fs = require("node:fs");
const path = require("node:path");

function makeCloudSave({ env = process.env, files, logger, fetchImpl = globalThis.fetch }) {
  const gistId = env.GIST_ID;
  const token = env.GITHUB_TOKEN;
  if (!gistId || !token) return null;
  const api = (env.GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, "");
  const headers = {
    authorization: "Bearer " + token,
    accept: "application/vnd.github+json",
    "user-agent": "FreeLLM-Router",
    "content-type": "application/json",
  };
  const last = {}; // file -> last uploaded content

  async function pull() {
    const r = await fetchImpl(`${api}/gists/${gistId}`, { headers });
    if (!r.ok) throw new Error(`gist download failed: HTTP ${r.status}`);
    const j = await r.json();
    let n = 0;
    for (const f of files) {
      const g = j.files && j.files[path.basename(f)];
      if (!g || typeof g.content !== "string" || !g.content.trim().startsWith("{")) continue;
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, g.content);
      last[f] = g.content;
      n++;
    }
    return n;
  }

  async function push() {
    const changed = {};
    for (const f of files) {
      let c;
      try {
        c = fs.readFileSync(f, "utf8");
      } catch {
        continue;
      }
      if (c !== last[f]) changed[path.basename(f)] = { content: c };
    }
    if (!Object.keys(changed).length) return 0;
    const r = await fetchImpl(`${api}/gists/${gistId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ files: changed }),
    });
    if (!r.ok) throw new Error(`gist upload failed: HTTP ${r.status}`);
    for (const f of files) {
      try {
        last[f] = fs.readFileSync(f, "utf8");
      } catch {
        /* ignore */
      }
    }
    return Object.keys(changed).length;
  }

  let timer = null;
  function start(seconds = Number(env.SYNC_SECONDS) || 60) {
    timer = setInterval(() => {
      push().catch((e) => logger.warn("cloud save failed", { error: e.message }));
    }, seconds * 1000);
    timer.unref();
  }
  function stop() {
    if (timer) clearInterval(timer);
  }
  return { pull, push, start, stop };
}

module.exports = { makeCloudSave };
