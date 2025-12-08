@echo off
echo Starting Lead Scraper API...
echo.

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt --quiet

REM Start the server
echo.
echo Starting server on http://127.0.0.1:8765
echo Press Ctrl+C to stop
echo.
python main.py
