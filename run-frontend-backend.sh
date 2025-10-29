#!/bin/bash

# Start backend API server in background
echo "🚀 Starting Backend API Server..."
cd /Users/anishgillella/Desktop/Stuff/Projects/AI\ Trading/apps/backend
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend dev server in background  
echo "🚀 Starting Frontend Dev Server..."
cd /Users/anishgillella/Desktop/Stuff/Projects/AI\ Trading/apps/frontend
npm run dev &
FRONTEND_PID=$!

echo "✅ Both servers started!"
echo "   Backend: http://localhost:3000"
echo "   Frontend: http://localhost:3000"
echo ""
echo "To stop both servers, press Ctrl+C"
echo ""

wait $BACKEND_PID $FRONTEND_PID
