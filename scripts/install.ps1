# Установить npm-зависимости внутри Docker volume
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
docker compose build
docker compose run --rm game npm install
Write-Host "Готово: зависимости в volume tverdynya_node_modules"
