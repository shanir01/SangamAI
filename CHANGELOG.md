# Changelog

## 2.1.0 - 2026-11-02 (SangamAI)

- Renamed FreeLLM-Router → **SangamAI** ("All free AI APIs, one endpoint"). GitHub redirects the old repo URL.
- New animated landing + docs page (English / हिंदी toggle) in `docs/`, served by GitHub Pages.
- Fix: an absolute `state_file` in the config is no longer joined onto the config folder.
- The "no API key" error no longer hard-codes port 8787 as the only address.
- Tested end to end from a fresh clone: `start.sh`, every page, `/v1/models`, chat (normal + streaming), fallback on 429, keys saved from the Setup page working without restart, `MASTER_KEY` protection.

## 2.0.0 - 2026-11-02 (FreeLLM-Router)

- Forked from free-llm-router 1.0.0 by Waseem Nasir (MIT).
- Localhost-first web app: Setup page (paste + test keys in the browser, saved to `keys.local.json`), Dashboard (usage bars, live status, fallback log), Playground, Connect page. One-click `start.bat` / `start.sh`.
- Server mode (`SERVER_MODE=true`, off by default) for hosting with user keys.
- `.env` file loading, `MASTER_KEY` (Bearer or `x-api-key`), `PORT`/`HOST` env for Render.
- Web dashboard: provider status, usage today / 7 days, models, playground.
- Multi-user API keys (`sk-flr-...`, stored hashed) with daily token quotas, on/off, regenerate, export/import; optional public `/signup`; `GET /v1/me`; `429 daily_quota_exceeded`.
- Round-robin strategy (`auto` alias), per-provider daily token/request counters, provider-wide shared limits (OpenRouter account cap), 402 failover, Hugging Face adapter.
- Models and free-tier limits updated from provider docs on 2026-11-02.
- Render blueprint (`render.yaml`), optional GitHub Gist cloud save, CORS, updated Dockerfile.
- 15 new tests (49 total).

## 1.0.0 - 2026-10-12 (upstream free-llm-router)

- Initial release by Waseem Nasir.
