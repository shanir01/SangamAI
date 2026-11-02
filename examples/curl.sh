#!/usr/bin/env sh
# Start the router first:  npm start   (keys in .env)
# Then:  KEY=your-master-key-or-user-key sh examples/curl.sh
BASE=${ROUTER_URL:-http://127.0.0.1:8787}
KEY=${KEY:-$MASTER_KEY}

echo "--- models"
curl -s "$BASE/v1/models" -H "Authorization: Bearer $KEY"
echo
echo "--- chat (non-streaming); -i shows which provider answered (x-router-provider)"
curl -si "$BASE/v1/chat/completions" \
  -H "Authorization: Bearer $KEY" \
  -H 'content-type: application/json' \
  -d '{"model":"auto","messages":[{"role":"user","content":"Say hi in five words"}]}'
echo
echo "--- chat (streaming)"
curl -sN "$BASE/v1/chat/completions" \
  -H "Authorization: Bearer $KEY" \
  -H 'content-type: application/json' \
  -d '{"model":"fast","stream":true,"messages":[{"role":"user","content":"Count to five"}]}'
echo
echo "--- my quota (user keys)"
curl -s "$BASE/v1/me" -H "Authorization: Bearer $KEY"
echo
