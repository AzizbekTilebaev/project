# Start Both Backend and Frontend Servers (development)
# Frontend Vite: http://localhost:3000  |  Backend: http://localhost:5000

$backendPath = Join-Path $PSScriptRoot "backend"
$frontendPath = Join-Path $PSScriptRoot "frontend"

Write-Host "Starting Qaraqalpaq Til Platformasi (dev)..." -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting Backend Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run dev"

Start-Sleep -Seconds 2

Write-Host "Starting Frontend Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev"

Write-Host ""
Write-Host "Both servers are starting in separate windows!" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Lokal production uchun: npm run start:prod (frontend build + backend NODE_ENV=production)" -ForegroundColor DarkGray
Write-Host "Toliq hujjat: d.md" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Press any key to exit this window (servers will continue running)..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
