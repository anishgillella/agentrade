# 🚀 How to Start and Test the Frontend

## Quick Start (2 Easy Steps)

### Step 1: Start Backend API Server
```bash
cd /Users/anishgillella/Desktop/Stuff/Projects/AI\ Trading/apps/backend
npm run dev
```

You'll see output like:
```
🚀 API Server running on http://localhost:3000
📡 WebSocket server ready for frontend connections
```

### Step 2: Start Frontend Dev Server (in new terminal)
```bash
cd /Users/anishgillella/Desktop/Stuff/Projects/AI\ Trading/apps/frontend
npm run dev
```

You'll see output like:
```
  ▲ Next.js 16.0.1
  - Local:        http://localhost:3001
```

## 🌐 Access the Frontend

**Open your browser and go to:** http://localhost:3001

## 📊 What You'll See

### Dashboard Sections:

1. **Header** (Top)
   - AI Trading System logo
   - Personality selector buttons (Buffett, Soros, Cathie, Contrarian)
   - Click to switch investment personalities

2. **Connection Status** (Right below header)
   - Green if connected to backend ✓
   - Red if backend is down ✗
   - Shows API and WebSocket status separately

3. **Generate Demo Signal Button**
   - Click to create sample trading signals
   - Useful for testing without running the full orchestrator

4. **Metrics Display** (4 cards)
   - Total Signals generated
   - Buy Signals (with count and percentage)
   - Sell Signals (with count and percentage)  
   - Average Confidence score (0-100%)

5. **Agent Status Panel** (Left column)
   - News Agent status
   - Investment Agent status
   - Personality Agent status
   - Shows: Active 🟢 / Processing 🟡 / Idle ⚪ / Error 🔴

6. **Signal Feed** (Center/Right - main area)
   - Real-time trading signals
   - Each signal shows:
     - Ticker symbol (AAPL, BTC, ETH, etc.)
     - Signal type: BUY (green) / SELL (red) / HOLD (yellow)
     - Confidence score (progress bar)
     - Sentiment analysis (progress bar)
     - News Agent recommendation
     - Personality Agent modifications (if any)
     - Execution time in milliseconds

7. **Execution Audit Trail** (Bottom)
   - Log of all agent actions
   - Shows: timestamp, agent name, status, duration
   - Color-coded for success ✓ or error ✗

## 🧪 Testing the Frontend

### Test 1: Generate Demo Signals
1. Click "Generate Demo Signal" button
2. Watch:
   - Signal appears in the Signal Feed
   - Metrics update (Total Signals +1)
   - Execution log shows new entry
   - Agent status updates every 5 seconds

### Test 2: Switch Personalities
1. Click different personality buttons (Buffett, Soros, Cathie, Contrarian)
2. Notice the button color changes
3. (Full effect would show different investment strategies when orchestrator is running)

### Test 3: Real-time Updates
1. Generate multiple signals by clicking the button repeatedly
2. Watch feed update in real-time
3. Metrics recalculate instantly
4. Confidence and sentiment scores vary

### Test 4: Connection Status
1. Stop the backend (Ctrl+C in backend terminal)
2. Frontend should show red "Disconnected" status
3. Start backend again
4. Frontend reconnects automatically (green status)

### Test 5: Agent Status Simulation
1. Watch the Agent Status panel
2. Every 5 seconds, agent status changes
3. Shows active/processing/idle cycling

## 🎨 Theme & UI Features

- **Dark Theme**: Professional dark interface optimized for trading
- **Responsive**: Works on desktop, tablet, and mobile
- **Real-time Updates**: WebSocket connection for instant data
- **Color Coding**:
  - 🟢 Green = BUY signals, Active status
  - 🔴 Red = SELL signals, Error status
  - �� Yellow = HOLD signals, Processing status
  - ⚪ Gray = Idle status

## 📱 Mobile View
The frontend is fully responsive - try resizing your browser window to see mobile layout with:
- Stacked cards instead of grid
- Bottom navigation-style layout
- Touch-friendly buttons

## 🔧 Configuration

**To change ports:**

Backend (edit `apps/backend/.env` or `apps/backend/src/config/settings.ts`):
```
BACKEND_PORT=3000
```

Frontend (already configured in `.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=http://localhost:3000
```

## 🚨 Troubleshooting

### Frontend shows "Disconnected" but backend is running
- Check if backend is on the correct port (3000)
- Try hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
- Check browser console for errors (F12 → Console tab)

### Buttons don't work or signals don't appear
- Ensure both terminals show no errors
- Clear browser cache: Cmd+Shift+Delete (Mac)
- Restart both servers

### Port already in use
**Backend port 3000 is in use:**
```bash
# Find process using port 3000
lsof -i :3000
# Kill it (replace PID with actual process ID)
kill -9 <PID>
```

**Frontend port 3001 is in use:**
```bash
# Find process using port 3001
lsof -i :3001
# Kill it
kill -9 <PID>
```

## 📊 Live Testing Workflow

1. **Start Backend** → See "API Server running" message
2. **Start Frontend** → See "Local: http://localhost:3001"
3. **Open Browser** → http://localhost:3001
4. **Verify Connected** → Green connection status
5. **Click Demo Button** → Watch signals appear
6. **Switch Personalities** → See button highlight change
7. **Generate More Signals** → Watch metrics update
8. **View Execution Log** → See all actions

## 🎯 What's Working End-to-End

✅ **Backend API**
- REST endpoints for signals, metrics, agents
- WebSocket real-time streaming
- CORS enabled for frontend
- Health check working

✅ **Frontend UI**
- All components rendering correctly
- Real-time WebSocket connection
- State management with Zustand
- Responsive design
- Dark theme styling

✅ **Integration**
- Frontend connects to backend API
- WebSocket subscription working
- Demo signal generation functional
- Metrics calculation working
- Agent status updates working

✅ **Build & Compile**
- Backend: TypeScript compiles without errors
- Frontend: Next.js builds successfully
- No linting errors
- Production builds work

## 📝 Next Steps

When orchestrator integrates:
- Real signals will flow through Kafka
- WebSocket will broadcast them to frontend
- Database will store all data
- Personality changes will affect strategies
- Paper trading will execute signals

