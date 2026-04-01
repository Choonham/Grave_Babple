# PowerShell Script: Artillery Scenario Token Updater
# Usage: .\update-scenarios.ps1

$ErrorActionPreference = "Stop"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Artillery Scenario Token Updater" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# 1. .env에서 토큰 읽기
$envFile = Join-Path $PSScriptRoot "..\.env"

if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "  Please run: npm run token" -ForegroundColor Yellow
    exit 1
}

$authToken = ""
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^AUTH_TOKEN=(.*)$') {
        $authToken = $matches[1].Trim()
    }
}

if (-not $authToken) {
    Write-Host "ERROR: AUTH_TOKEN not found in .env!" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Found AUTH_TOKEN (first 30 chars): $($authToken.Substring(0, 30))..." -ForegroundColor Green
Write-Host ""

# 2. 모든 시나리오 파일 업데이트
$scenariosDir = Join-Path $PSScriptRoot "..\scenarios"
$scenarioFiles = @("feed.yml", "recipe-detail.yml", "recipe-upload.yml", "mixed-scenario.yml")

$updatedCount = 0

foreach ($file in $scenarioFiles) {
    $filePath = Join-Path $scenariosDir $file
    
    if (-not (Test-Path $filePath)) {
        Write-Host "[WARN] File not found: $file" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "[INFO] Updating: $file" -ForegroundColor Cyan
    
    $content = Get-Content $filePath -Raw -Encoding UTF8
    
    # authToken 라인을 찾아서 교체
    $pattern = '(authToken:\s*")[^"]*(")'
    $replacement = "`$1$authToken`$2"
    
    if ($content -match $pattern) {
        $newContent = $content -replace $pattern, $replacement
        # UTF8 without BOM to preserve Korean characters
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($filePath, $newContent, $utf8NoBom)
        Write-Host "  ✓ Updated successfully" -ForegroundColor Green
        $updatedCount++
    } else {
        Write-Host "  ✗ authToken pattern not found" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Summary: Updated $updatedCount/$($scenarioFiles.Count) files" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now run load tests:" -ForegroundColor Cyan
Write-Host "  npm run test:feed" -ForegroundColor Yellow
Write-Host "  npm run test:mixed" -ForegroundColor Yellow
Write-Host ""

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

