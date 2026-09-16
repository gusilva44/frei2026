# Start the API server
Write-Host "Starting API server..."
Start-Process node -ArgumentList "src/server.js" -WorkingDirectory "C:\Users\Robson\Desktop\feira site 2026\frei2026\api" -WindowStyle Hidden

# Wait for API to start
Start-Sleep -Seconds 3

# Start the frontend (Vite)
Write-Host "Starting frontend (Vite dev server)..."
Start-Process cmd -ArgumentList "/C", "C:\Users\Robson\Desktop\feira site 2026\frei2026\web\node_modules\.bin\vite", "dev" -WorkingDirectory "C:\Users\Robson\Desktop\feira site 2026\frei2026\web" -WindowStyle Hidden

Write-Host "Application starting up..."
Write-Host "Frontend will be available at http://localhost:5173"
Write-Host "API will be available at http://localhost:5050"
Write-Host "Admin credentials: admin@feira.local / admin123"