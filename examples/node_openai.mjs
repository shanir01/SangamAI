// npm install openai   then:  node examples/node_openai.mjs
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.ROUTER_URL || "http://127.0.0.1:8787/v1",
  apiKey: process.env.API_KEY || "PASTE_YOUR_KEY_HERE",
});

const r = await client.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Say hi in Hinglish" }],
});
console.log(r.choices[0].message.content);
