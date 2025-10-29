# Frontend Setup & Integration Guide

## ✅ Architecture Overview

The frontend is fully integrated with the backend via:
- **REST API** for fetching data
- **WebSocket (Socket.io)** for real-time signal streaming
- **Zustand** for state management
- **Tailwind CSS + shadcn/ui** for UI components

## 📋 Installation

### Backend Dependencies
```bash
cd apps/backend
npm install
```

### Frontend Dependencies
```bash
cd apps/frontend
npm install --legacy-peer-deps
```

## 🚀 Running the System

### Option 1: Run Individually

**Terminal 1 - Backend API Server:**
```bash
cd apps/backend
npm run dev
# Starts on http://localhost:3000
```

**Terminal 2 - Frontend Dev Server:**
```bash
cd apps/frontend
npm run dev
# Starts on http://localhost:3001
```

### Option 2: Run Both Together
```bash
cd /Users/anishgillella/Desktop/Stuff/Projects/AI\ Trading
./run-frontend-backend.sh
```

## 🔌 API Integration Points

### REST Endpoints
- `GET /api/health` - Health check
- `GET /api/signals` - Fetch all signals
- `GET /api/signals/:id` - Get specific signal
- `GET /api/metrics` - Get trading metrics
- `GET /api/agents` - Get agent status
- `GET /api/executions` - Get execution logs
- `POST /api/personality` - Change personality mode

### WebSocket Events
- `signals:initial` - Initial signal data on connection
- `signal:new` - Real-time signal updates
- `agent:status` - Agent status updates
- `execution:log` - Execution log streaming

## 🎨 Frontend Features

### Components Built
- ✅ Header with personality selector
- ✅ Real-time signal feed with confidence scores
- ✅ Agent status panel with health indicators
- ✅ Metrics display (total signals, buy/sell ratio, confidence)
- ✅ Execution audit trail
- ✅ Connection status indicator
- ✅ Demo signal generator

### State Management
- Zustand store for signals, agents, executions, and personality
- Real-time updates via WebSocket
- Auto-refresh interval (5 seconds)

## 🧪 Testing the Integration

### 1. Check Backend Builds
```bash
cd apps/backend
npm run build
```
✅ Should complete without errors

### 2. Check Frontend Builds
```bash
cd apps/frontend
npm run build
```
✅ Should complete without errors

### 3. Check Linting
```bash
cd apps/frontend
npm run lint
```
✅ Should have no errors

### 4. Runtime Test
```bash
# Terminal 1
cd apps/backend
npm run dev

# Terminal 2 (wait for backend to start)
cd apps/frontend
npm run dev

# Open http://localhost:3001 in browser
```

### 5. Manual Testing
- Click "Generate Demo Signal" button
- Watch signal appear in feed
- Check metrics update
- Switch personalities
- Verify execution log

## 📊 Demo Features

**Generate Demo Signal Button:**
- Creates random trading signal
- Updates all metrics
- Shows in signal feed
- Adds execution log entry

**Agent Status Simulation:**
- Updates agent status every 5 seconds
- Shows active/idle/processing/error states

## 🔧 Configuration

### Environment Variables
Create `.env.local` in `apps/frontend`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=http://localhost:3000
```

### Backend Config
Backend reads from `.env` in root:
- `BACKEND_PORT=3000`
- `NODE_ENV=development`

## 🐛 Troubleshooting

### Frontend won't connect to backend
- Ensure backend is running on port 3000
- Check firewall/CORS settings
- Verify env vars in `.env.local`

### WebSocket connection fails
- Check browser console for errors
- Ensure Socket.io client/server versions match
- Try hard refresh (Cmd+Shift+R)

### Build errors
- Run `npm install --legacy-peer-deps` in frontend
- Clear `.next` folder: `rm -rf apps/frontend/.next`
- Try: `npm cache clean --force`

## 📦 Production Build

### Build Both Apps
```bash
cd apps/backend
npm run build

cd ../frontend
npm run build
```

### Run Production
```bash
# Backend
cd apps/backend
npm start

# Frontend (in another terminal)
cd apps/frontend
npm start
```

## 🎯 Next Steps

1. ✅ Frontend UI complete with all MVP components
2. ✅ API server with REST endpoints
3. ✅ WebSocket integration for real-time updates
4. ⏭️ Connect orchestrator to broadcast real signals
5. ⏭️ Add database persistence for signals
6. ⏭️ Implement personality change API
7. ⏭️ Add paper trading UI (Phase 2)

## 📝 Notes

- Frontend is responsive (mobile-friendly)
- Dark theme optimized for trading
- All dependencies compatible with Node 18+
- Ready for Docker deployment
