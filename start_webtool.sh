#!/bin/bash
# start_webtool.sh - One-click launch for WebTool in Chrome via WSL

echo "🚀 Starting WebTool Living System..."

# 1. Start Vite in the background
npm run dev & 
VITE_PID=$!

# 2. Wait for the server to actually be ready
echo "⏳ Waiting for server to ignite..."
sleep 3

# 3. Force Chrome to open via Windows CMD
# This bypasses WSL browser issues and opens the actual Windows Chrome
cmd.exe /c "start chrome http://localhost:5173"

echo "✅ WebTool is now open in Chrome!"
echo "Press Ctrl+C to stop the server."

# Keep the script alive so the background Vite process doesn't die immediately
wait $VITE_PID
