# pip install openai
# Works with your MASTER_KEY or with a user key (sk-flr-...).
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:8787/v1",   # or https://your-app.onrender.com/v1
    api_key="PASTE_YOUR_KEY_HERE",
)

resp = client.chat.completions.create(
    model="auto",   # aliases: auto, fast, smart, long-context (see GET /v1/models)
    messages=[{"role": "user", "content": "Namaste! Ek line me apna intro do."}],
)
print(resp.choices[0].message.content)

# streaming
for chunk in client.chat.completions.create(
    model="fast", stream=True,
    messages=[{"role": "user", "content": "Count from 1 to 5"}],
):
    print(chunk.choices[0].delta.content or "", end="", flush=True)
print()
