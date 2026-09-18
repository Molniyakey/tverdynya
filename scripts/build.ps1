# Production-сборка в ./dist через Docker
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
docker compose run --rm game npm run build
Write-Host "Сборка в папке dist/"
