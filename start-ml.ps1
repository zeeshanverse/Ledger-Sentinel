# Starts the FastAPI ML service on http://127.0.0.1:8001
Set-Location "$PSScriptRoot\ml-service"
if (-not (Test-Path ".\.venv\Scripts\Activate.ps1")) {
    python -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -r requirements.txt
} else {
    .\.venv\Scripts\Activate.ps1
}
# NOTE: module is "app" (app.py), NOT "app.main"
python -m uvicorn app:app --reload --host 127.0.0.1 --port 8001
