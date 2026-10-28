@echo off
rem Opens the slides without the internet (on a plane, or when the venue's network is down): double-click this file.
rem Browsers do not run the slides' modules from file://, so it starts a local server here (Python) and opens the
rem browser on the slides as soon as the server answers.  Close this window to stop the server.
rem The QR codes still need the internet to open the site.
cd /d "%~dp0"
set PORT=8026
set URL=http://127.0.0.1:%PORT%/slides/
rem Already running (double-clicked twice): only open the browser.
netstat -an | find "127.0.0.1:%PORT% " | find "LISTENING" >nul && (
  echo The server is already running: %URL%
  start "" "%URL%"
  timeout /t 3 >nul
  exit /b 0
)
where python >nul 2>nul || (
  echo Python was not found. Install Python 3, or run: npx http-server -p %PORT% -a 127.0.0.1
  pause
  exit /b 1
)
start "" powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 50; $i++) { try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', %PORT%); $c.Close(); break } catch { Start-Sleep -Milliseconds 200 } }; Start-Process '%URL%'"
echo The slides:    %URL%
echo The talk site: http://127.0.0.1:%PORT%/
echo Close this window to stop the server.
python -m http.server %PORT% --bind 127.0.0.1
pause
