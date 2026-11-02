"use strict";

/**
 * Copy an upstream fetch Response body to a Node ServerResponse byte-for-byte.
 * No parsing, no re-framing: SSE chunks reach the client exactly as sent.
 * While copying, it also watches the SSE lines (a side copy) so the router can count
 * tokens: it picks up the `usage` object when the provider sends one, and otherwise
 * counts the characters of the generated text for an estimate.
 * Resolves with { bytes, usage, contentChars }.
 */
async function pipeStream(upstream, res) {
  let bytes = 0;
  let usage = null;
  let contentChars = 0;
  let pending = "";
  const decoder = new TextDecoder();
  const scan = (text) => {
    pending += text;
    let nl;
    while ((nl = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, nl).trim();
      pending = pending.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        if (j.usage && typeof j.usage === "object") usage = j.usage;
        for (const ch of j.choices || []) {
          const d = ch.delta || {};
          if (typeof d.content === "string") contentChars += d.content.length;
          if (typeof d.reasoning === "string") contentChars += d.reasoning.length;
        }
      } catch {
        /* not JSON: ignore */
      }
    }
  };
  if (!upstream.body) return { bytes, usage, contentChars };
  for await (const chunk of upstream.body) {
    bytes += chunk.length;
    try {
      scan(decoder.decode(chunk, { stream: true }));
    } catch {
      /* counting must never break the stream */
    }
    if (!res.write(chunk)) {
      await new Promise((resolve) => res.once("drain", resolve));
    }
  }
  return { bytes, usage, contentChars };
}

module.exports = { pipeStream };
