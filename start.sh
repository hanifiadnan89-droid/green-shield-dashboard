#!/bin/bash
# Green Shield Dashboard — start script
# Run this from the green-shield-dashboard folder

echo ""
echo "🛡️  Green Shield Control Center"
echo "================================"
echo ""
echo "Starting server on http://localhost:3001"
echo "Starting UI    on http://localhost:5173"
echo ""
echo "Open http://localhost:5173 in your browser."
echo "Press Ctrl+C to stop."
echo ""

cd "$(dirname "$0")"
npm run dev
