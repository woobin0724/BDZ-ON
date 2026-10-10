#!/usr/bin/env bash
# 온잇다 시연 실행 (맥·리눅스). 최초 실행 시 설치까지 자동으로 진행한다.
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "[온잇다] Node.js 20 이상이 필요합니다: https://nodejs.org"; exit 1; }
if [ ! -x backend/.venv/bin/python ] || [ ! -d frontend/node_modules ] || [ ! -d node_modules ]; then
  npm run setup
fi
node scripts/open-when-ready.mjs http://localhost:8000/demo &
npm run demo
