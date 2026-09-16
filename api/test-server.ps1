Start-Sleep -Seconds 3
$url = "http://localhost:5050/health"
try {
    $result = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 5
    Write-Host "Server responding: $($result.StatusCode)"
} catch {
    Write-Host "Server not responding: $_"
}