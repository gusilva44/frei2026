# Start the API server in the background
$process = Start-Process node -ArgumentList "src/server.js" -WorkingDirectory "C:\Users\Robson\Desktop\feira site 2026\frei2026\api" -PassThru -WindowStyle Hidden

# Wait for server to start
Start-Sleep -Seconds 3

# Test login
$url = "http://localhost:5050/auth/login"
$body = @{ email = "admin@feira.local"; senha = "admin123" } | ConvertTo-Json

try {
    $result = Invoke-WebRequest -Uri $url -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10
    Write-Host "Login Status: $($result.StatusCode)"
    Write-Host "Response: $($result.Content)"}
catch {
    Write-Host "Login failed: $_"
}

# Kill the server
$process.Kill()