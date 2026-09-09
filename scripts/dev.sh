#!/usr/bin/env bash
# One-command local dev startup (no Docker): installs deps if missing, seeds
# the SQLite database, and runs backend + frontend together. Ctrl+C stops both.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== SIH26006 Freight Intelligence - dev startup =="

# ---- Backend ----------------------------------------------------------
cd "$ROOT_DIR/backend"
if [ ! -d ".venv" ]; then
  echo "-- Creating Python virtual environment (backend/.venv) ..."
  python3 -m venv .venv
fi
source .venv/bin/activate
echo "-- Installing backend dependencies ..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

if [ ! -f "freight.db" ]; then
  echo "-- Seeding SQLite database ..."
  python -m app.seed
fi

if [ ! -f "$ROOT_DIR/ml/models/freight_model.joblib" ]; then
  echo "-- No trained model artifact found - training baseline model ..."
  (cd "$ROOT_DIR" && python ml/training/train.py)
fi

echo "-- Starting backend on http://localhost:8000 ..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

cleanup() {
  echo ""
  echo "Stopping backend (pid $BACKEND_PID) and frontend (pid ${FRONTEND_PID:-n/a}) ..."
  kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ---- Frontend -----------------------------------------------------------
cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ]; then
  echo "-- Installing frontend dependencies (npm install) ..."
  npm install
fi
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
fi

echo "-- Starting frontend on http://localhost:3000 ..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000  (docs at /docs)"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop both."

wait
