#!/usr/bin/env sh
# FreeLLM Router - one-command start for Android (Termux), Linux and Mac
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  if [ -n "$PREFIX" ] && command -v pkg >/dev/null 2>&1; then
    echo "Installing Node.js (Termux)..."
    pkg install -y nodejs-lts || pkg install -y nodejs
  elif command -v apt-get >/dev/null 2>&1; then
    echo "Installing Node.js (apt)..."
    sudo apt-get update && sudo apt-get install -y nodejs
  elif command -v brew >/dev/null 2>&1; then
    brew install node
  else
    echo "Please install Node.js 20+ from https://nodejs.org and run ./start.sh again"
    exit 1
  fi
fi

MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$MAJOR" -lt 20 ] 2>/dev/null; then
  echo "Node.js $MAJOR is too old; FreeLLM Router needs Node 20+."
  echo "Termux: pkg upgrade nodejs-lts   |   others: https://nodejs.org"
  exit 1
fi

PORT=${PORT:-8787}
URL="http://localhost:$PORT"
echo ""
echo "  FreeLLM Router is starting..."
echo "  Open:  $URL   (Setup page)"
echo "  API :  $URL/v1"
echo "  Stop:  Ctrl+C"
echo ""

# keep Android from killing it, and open the browser (best effort)
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock
( sleep 1.5
  if command -v termux-open-url >/dev/null 2>&1; then termux-open-url "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  elif command -v open >/dev/null 2>&1; then open "$URL"
  fi ) &

HOST=${HOST:-127.0.0.1} exec node src/server.js --port "$PORT"
