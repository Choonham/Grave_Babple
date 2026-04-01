# PowerShell Script: 깨진 시나리오 파일 복구
# Usage: .\restore-scenarios.ps1

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Scenario File Restoration" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$scenariosDir = Join-Path $PSScriptRoot "..\scenarios"
$scenarioFiles = @("feed.yml", "recipe-detail.yml", "recipe-upload.yml", "mixed-scenario.yml")

Write-Host "[INFO] Converting files from broken encoding to UTF-8..." -ForegroundColor Yellow
Write-Host ""

foreach ($file in $scenarioFiles) {
    $filePath = Join-Path $scenariosDir $file
    
    if (-not (Test-Path $filePath)) {
        Write-Host "[SKIP] File not found: $file" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "[INFO] Processing: $file" -ForegroundColor Cyan
    
    try {
        # Read with default encoding (might be corrupted)
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        
        # Try to detect if it's actually UTF-8
        $content = [System.Text.Encoding]::UTF8.GetString($bytes)
        
        # Write back with UTF-8 without BOM
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($filePath, $content, $utf8NoBom)
        
        Write-Host "  ✓ Converted successfully" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Restoration Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If files are still broken, you need to:" -ForegroundColor Yellow
Write-Host "  1. Open each .yml file in VS Code" -ForegroundColor White
Write-Host "  2. Click 'UTF-8 with BOM' in bottom right" -ForegroundColor White
Write-Host "  3. Select 'Save with Encoding' -> 'UTF-8'" -ForegroundColor White
Write-Host ""

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

