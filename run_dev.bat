@echo off
echo =======================================================
echo   Smart India Hackathon 2026 - Cadastral AI Mapper     
echo   AI-enabled Automated Cadastral Mapping Platform       
echo =======================================================

IF EXIST venv\Scripts\activate.bat (
    echo Activating virtual environment (venv)...
    call venv\Scripts\activate.bat
) ELSE IF EXIST .venv\Scripts\activate.bat (
    echo Activating virtual environment (.venv)...
    call .venv\Scripts\activate.bat
)

REM Initialize DB
python -c "from backend.db.database import init_db; init_db()"

echo Launching FastAPI Backend on http://localhost:8000...
start "Cadastral AI Backend" cmd /k uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

echo Launching Frontend Dashboard on http://localhost:3000...
start "Cadastral AI Frontend" cmd /k python -m http.server 3000 --directory frontend

echo -------------------------------------------------------
echo SIH 2026 - Cadastral AI Mapper is running!
echo Backend API Docs:  http://127.0.0.1:8000/docs
echo Frontend Dashboard: http://127.0.0.1:3000
echo -------------------------------------------------------
pause
