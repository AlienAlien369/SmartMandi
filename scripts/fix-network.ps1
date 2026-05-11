# fix-network.ps1
# Auto-detects your WiFi IP and updates mobile/src/api/constants.ts
# Run this once whenever you get a network error: .\scripts\fix-network.ps1

$constantsPath = "$PSScriptRoot\..\apps\mobile\src\api\constants.ts"

# Get the active WiFi IPv4 (192.168.x.x preferred)
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -match '^192\.168\.' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1).IPAddress

if (-not $ip) {
  # Fallback: any non-loopback private IP
  $ip = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1).IPAddress
}

if (-not $ip) {
  Write-Error "Could not detect a local IP. Are you connected to WiFi?"
  exit 1
}

Write-Host "Detected IP: $ip" -ForegroundColor Cyan

# Read constants.ts and replace the active WiFi line
$content = Get-Content $constantsPath -Raw
$newContent = $content -replace "(?m)(^\s*\? 'http://)[\d\.]+(:3000/api/v1')", "`${1}${ip}`${2}"

if ($content -eq $newContent) {
  Write-Host "constants.ts already has IP $ip — no change needed." -ForegroundColor Green
} else {
  Set-Content $constantsPath $newContent -NoNewline
  Write-Host "Updated constants.ts → http://${ip}:3000/api/v1" -ForegroundColor Green
}

# Verify Docker API is reachable
try {
  $resp = Invoke-WebRequest -Uri "http://${ip}:3000/api/v1/auth/login" -Method POST -TimeoutSec 3 -ErrorAction SilentlyContinue
  Write-Host "API reachable at http://${ip}:3000" -ForegroundColor Green
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  if ($code -ge 400) {
    Write-Host "API reachable at http://${ip}:3000 (returned $code — normal)" -ForegroundColor Green
  } else {
    Write-Host "WARNING: API may not be reachable. Is Docker running?" -ForegroundColor Yellow
    Write-Host "Run: docker compose up -d" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Done! Now run: cd apps\mobile && npx react-native run-android" -ForegroundColor Cyan
