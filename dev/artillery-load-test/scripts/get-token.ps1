# PowerShell Script: Get Artillery Load Test Token
# Usage: .\get-token.ps1

$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot "..\\.env"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Artillery Token Generator" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Read .env file
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Variable -Name $key -Value $value -Scope Script
        }
    }
} else {
    Write-Host "[ERROR] .env file not found!" -ForegroundColor Red
    Write-Host "Path: $envFile" -ForegroundColor Yellow
    exit 1
}

# Check environment variables
if (-not $BASE_URL) {
    Write-Host "[ERROR] BASE_URL is not set!" -ForegroundColor Red
    exit 1
}

if (-not $TEST_EMAIL) {
    Write-Host "[ERROR] TEST_EMAIL is not set!" -ForegroundColor Red
    exit 1
}

if (-not $TEST_PASSWORD) {
    Write-Host "[ERROR] TEST_PASSWORD is not set!" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Configuration:" -ForegroundColor Green
Write-Host "  Server: $BASE_URL" -ForegroundColor White
Write-Host "  Email: $TEST_EMAIL" -ForegroundColor White
Write-Host ""

# Login API call
Write-Host "[INFO] Logging in..." -ForegroundColor Yellow

$loginUrl = "$BASE_URL"
if (-not $loginUrl.EndsWith("/api")) {
    $loginUrl = "$loginUrl/api"
}
$loginUrl = "$loginUrl/auth/login"

$body = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
    fcmToken = "artillery-load-test-token"
    deviceId = "artillery-load-test-device"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $loginUrl `
        -Method Post `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 30
    
    if ($response.success -and $response.data.token) {
        $token = $response.data.token
        $tokenPreview = $token.Substring(0, [Math]::Min(50, $token.Length))
        
        Write-Host ""
        Write-Host "[SUCCESS] Login successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Token (first 50 chars):" -ForegroundColor Cyan
        Write-Host "  $tokenPreview..." -ForegroundColor White
        Write-Host ""
        
        # Update .env file
        $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        $envContent = @"
# Environment Variables
# Windows Local Environment - Remote Server Test

# Remote Server URL
BASE_URL=$BASE_URL

# Test Account
TEST_EMAIL=$TEST_EMAIL
TEST_PASSWORD=$TEST_PASSWORD

# Auth Token (Auto-generated at $timestamp)
AUTH_TOKEN=$token
"@
        
        Set-Content -Path $envFile -Value $envContent -Encoding UTF8
        
        Write-Host "[SUCCESS] .env file updated!" -ForegroundColor Green
        Write-Host "  Path: $envFile" -ForegroundColor White
        Write-Host ""
        
        # Update all scenario files with new token
        Write-Host "[INFO] Updating scenario files with new token..." -ForegroundColor Cyan
        Write-Host ""
        
        $scenariosDir = Join-Path $PSScriptRoot "..\scenarios"
        $scenarioFiles = @("feed.yml", "recipe-detail.yml", "recipe-upload.yml", "mixed-scenario.yml")
        $updatedCount = 0
        
        foreach ($file in $scenarioFiles) {
            $filePath = Join-Path $scenariosDir $file
            
            if (-not (Test-Path $filePath)) {
                Write-Host "  [WARN] File not found: $file" -ForegroundColor Yellow
                continue
            }
            
            Write-Host "  [INFO] Updating: $file" -ForegroundColor White
            
            $content = Get-Content $filePath -Raw -Encoding UTF8
            
            # authToken 라인을 찾아서 교체
            $pattern = '(authToken:\s*")[^"]*(")'
            $replacement = "`$1$token`$2"
            
            if ($content -match $pattern) {
                $newContent = $content -replace $pattern, $replacement
                # UTF8 without BOM to preserve Korean characters
                $utf8NoBom = New-Object System.Text.UTF8Encoding $false
                [System.IO.File]::WriteAllText($filePath, $newContent, $utf8NoBom)
                Write-Host "    ✓ Updated successfully" -ForegroundColor Green
                $updatedCount++
            } else {
                Write-Host "    ✗ authToken pattern not found" -ForegroundColor Red
            }
        }
        
        Write-Host ""
        Write-Host "[SUCCESS] Updated $updatedCount/$($scenarioFiles.Count) scenario files" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "You can now run load tests:" -ForegroundColor Cyan
        Write-Host "  .\quick-start.bat" -ForegroundColor Yellow
        Write-Host "  or" -ForegroundColor White
        Write-Host "  npm run test:feed" -ForegroundColor Yellow
        Write-Host ""
        
    } else {
        Write-Host "[ERROR] Login failed: No token received" -ForegroundColor Red
        Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Yellow
        exit 1
    }
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] Login failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Checklist:" -ForegroundColor Cyan
    Write-Host "  1. Check if server is running: $BASE_URL" -ForegroundColor White
    Write-Host "  2. Verify email/password" -ForegroundColor White
    Write-Host "  3. Check network connection" -ForegroundColor White
    Write-Host ""
    exit 1
}
