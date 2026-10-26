# Starts the React dashboard on http://localhost:5173
Set-Location "$PSScriptRoot\frontend"
if (-not (Test-Path ".\node_modules")) { npm install }
npm run dev
