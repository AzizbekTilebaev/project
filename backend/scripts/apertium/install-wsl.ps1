#Requires -RunAsAdministrator
<#
.SYNOPSIS
  WSL + Ubuntu o‘rnatadi (Administrator PowerShell’da ishga tushiring).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File "scripts\apertium\install-wsl.ps1"
#>

$ErrorActionPreference = 'Stop'
Write-Host "==> WSL o‘rnatilmoqda (Ubuntu)..." -ForegroundColor Cyan

try {
  wsl --status 2>$null | Out-Null
  $hasWsl = $true
} catch {
  $hasWsl = $false
}

if (-not $hasWsl) {
  Write-Host "==> Feature: Microsoft-Windows-Subsystem-Linux"
  dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
  Write-Host "==> Feature: VirtualMachinePlatform"
  dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
  Write-Host ""
  Write-Host "QAYTA YUKLASH kerak. Keyin shu skriptni yana ishga tushiring yoki:" -ForegroundColor Yellow
  Write-Host '  wsl --install -d Ubuntu'
  Write-Host ""
  $ans = Read-Host "Hozir qayta yuklash? (y/n)"
  if ($ans -match '^[yY]') {
    Restart-Computer
  }
  exit 0
}

Write-Host "==> wsl --install -d Ubuntu"
wsl --install -d Ubuntu

Write-Host ""
Write-Host "Ubuntu birinchi ochilganda username/password so‘raydi." -ForegroundColor Green
Write-Host "Tayyor bo‘lgach (oddiy PowerShell’da):" -ForegroundColor Green
Write-Host '  cd "c:\Users\aziz\Desktop\projects 2\proyekt2\backend"'
Write-Host '  wsl -e bash scripts/apertium/00-install-deps.sh'
Write-Host '  wsl -e bash scripts/apertium/01-build-kaa.sh'
Write-Host '  node scripts/export-dict-for-apertium.mjs'
Write-Host '  wsl -e bash scripts/apertium/02-analyze-dict.sh'
Write-Host '  node scripts/import-apertium-morph.mjs'
