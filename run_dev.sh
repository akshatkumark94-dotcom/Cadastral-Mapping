#!/usr/bin/env bash
set -e

echo "======================================================="
echo "  Smart India Hackathon 2026 - Cadastral AI Mapper     "
echo "  AI-enabled Automated Cadastral Mapping Platform       "
echo "======================================================="

# Activate Virtual Environment if it exists
if [ -d "venv" ]; then
    echo "Activating virtual environment (venv)..."
    source venv/bin/activate
elif [ -d ".venv" ]; then
    echo "Activating virtual environment (.venv)..."
    source .venv/bin/activate
fi

# Ensure database is initialized
python3 -c "from backend.db.database import init_db; init_db()" 2>/dev/null || true

# Start FastAPI Backend in background
echo "Launching FastAPI Backend on http://localhost:8000..."
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start Frontend static file server
echo "Launching Frontend Dashboard on http://localhost:3000..."
python3 -m http.server 3000 --directory frontend &
FRONTEND_PID=$!

echo "-------------------------------------------------------"
echo "SIH 2026 - Cadastral AI Mapper is running!"
echo "Backend API Docs:  http://localhost:8000/docs"
echo "Frontend Dashboard: http://localhost:3000"
echo "Press CTRL+C to stop both servers."
echo "-------------------------------------------------------"

cleanup() {
    echo "Stopping servers..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM
wait
