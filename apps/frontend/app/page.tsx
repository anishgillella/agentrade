'use client'

import { useEffect, useState } from 'react'
import { Header } from './components/header'
import { MetricsDisplay } from './components/metrics-display'
import { AgentStatusPanel } from './components/agent-status-panel'
import { SignalFeed } from './components/signal-feed'
import { ExecutionLog } from './components/execution-log'
import { useStore, type Signal, type Execution } from './store'
import { useApi } from './hooks/useApi'
import { useWebSocket } from './hooks/useWebSocket'
import { useAutoSignalGenerator } from './hooks/useAutoSignalGenerator'

export default function Home() {
  const { addSignal, addExecution, updateAgentStatus } = useStore()
  const api = useApi()
  const { isConnected: wsConnected, error: wsError } = useWebSocket()
  const [connectionStatus, setConnectionStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading')

  // Auto-generate realistic signals showing full pipeline
  useAutoSignalGenerator()

  // Initialize data from backend
  useEffect(() => {
    if (api.isConnected) {
      setConnectionStatus('connected')
      loadInitialData()
    } else {
      setConnectionStatus('disconnected')
    }
  }, [api.isConnected])

  const loadInitialData = async () => {
    try {
      // Fetch initial signals
      const signals = await api.fetchSignals()
      signals.forEach(signal => addSignal(signal))

      // Fetch agent status
      const agentsData = await api.fetchAgents()
      if (agentsData?.agents) {
        agentsData.agents.forEach((agent: any) => {
          updateAgentStatus(agent.id, agent.status)
        })
      }
    } catch (error) {
      console.error('Failed to load initial data:', error)
    }
  }

  // Add demo button to generate sample signals
  const generateDemoSignal = () => {
    const tickers = ['AAPL', 'GOOGL', 'MSFT', 'TESLA', 'BTC', 'ETH']
    const types = ['BUY', 'SELL', 'HOLD'] as const
    
    const newsArticles: Record<string, string> = {
      AAPL: 'Apple Q4 earnings beat expectations with strong iPhone 16 sales. Analysts raise price targets to $250.',
      GOOGL: 'Google Cloud revenue grows 35% YoY. New AI partnerships announced with enterprise clients.',
      MSFT: 'Microsoft Azure AI adoption accelerates. Enterprise spending on cloud services increases 28%.',
      TESLA: 'Tesla deliveries exceed estimates. Stock rallies on positive delivery numbers and margin expansion.',
      BTC: 'Bitcoin breaks above $70k on institutional inflows. Spot ETF sees record weekly purchases.',
      ETH: 'Ethereum staking rewards hit new highs. Network activity increases with Layer 2 adoption.',
    }

    const investmentReasons: Record<string, string> = {
      BUY: 'Strong technical breakout above resistance level. Positive momentum with increasing volume and institutional accumulation detected.',
      SELL: 'Bearish divergence on daily chart. Resistance rejection with declining volume suggests weakening buyer interest.',
      HOLD: 'Consolidation phase within established range. Waiting for confirmation before making directional move.',
    }

    const personalityStrategies: Record<string, Record<string, string>> = {
      buffett: {
        BUY: 'Strong fundamentals with proven business model. Long-term value play with sustainable competitive advantage.',
        SELL: 'Valuation has gotten excessive. Better to wait for pullback to accumulate at reasonable price.',
        HOLD: 'Already holding position. Monitoring quarterly earnings for confirmation of thesis.',
      },
      soros: {
        BUY: 'Market inflection point detected. Momentum favors breakout traders in current cycle.',
        SELL: 'Macro headwinds building. Technical exhaustion suggests profit-taking opportunity.',
        HOLD: 'Waiting for clearer market direction before committing capital.',
      },
      cathie: {
        BUY: 'Disruptive innovation secular growth story. AI adoption metrics show acceleration in this sector.',
        SELL: 'Valuation stretched. Better growth opportunities elsewhere with more attractive risk/reward.',
        HOLD: 'Core holding for innovation exposure. Monitoring AI revenue contribution.',
      },
      contrarian: {
        BUY: 'Crowd is bearish - classic contrarian opportunity. Capitulation signals often precede rallies.',
        SELL: 'Euphoria index is extremely high. Contrarian signal for taking profits.',
        HOLD: 'Mixed sentiment still. Waiting for more extreme readings.',
      },
    }

    const selectedTicker = tickers[Math.floor(Math.random() * tickers.length)]
    const selectedType = types[Math.floor(Math.random() * types.length)]
    const personality = useStore.getState().personality
    
    const signal: Signal = {
      id: Math.random().toString(36).substr(2, 9),
      ticker: selectedTicker,
      type: selectedType,
      confidence: Math.random() * 0.3 + 0.65,
      sentiment: Math.random() - 0.5,
      timestamp: new Date(),
      newsAgentRecommendation: 'Positive momentum detected in news',
      newsSummary: newsArticles[selectedTicker],
      investmentAgentReasoning: investmentReasons[selectedType],
      personalityReasoning: personalityStrategies[personality][selectedType],
      personalityVeto: Math.random() > 0.85,
      personalityModification: Math.random() > 0.75 ? 'Risk adjusted for position size' : undefined,
      executionTime: Math.random() * 400 + 80,
    }
    
    addSignal(signal)

    // Add corresponding execution log
    const execution: Execution = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      agentName: 'Investment Agent',
      action: `Analyzed ${signal.ticker}`,
      input: 'market_data,news_sentiment,technical_indicators',
      output: signal.type,
      status: 'success',
      duration: signal.executionTime,
    }
    
    addExecution(execution)
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      
      <div className="p-6 space-y-6">
        {/* Connection Status */}
        <div className={`p-3 rounded-lg border flex items-center justify-between ${
          api.isConnected && wsConnected
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <div>
            <p className="font-medium text-sm">
              {api.isConnected && wsConnected ? '✓ Connected' : '✗ Disconnected'}
            </p>
            {api.error && <p className="text-xs mt-1">{api.error}</p>}
            {wsError && <p className="text-xs mt-1">{wsError}</p>}
          </div>
          <div className="text-xs">
            <span className={`px-2 py-1 rounded ${api.isConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              API: {api.isConnected ? 'OK' : 'Down'}
            </span>
            <span className={`px-2 py-1 rounded ml-2 ${wsConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              WS: {wsConnected ? 'OK' : 'Down'}
            </span>
          </div>
        </div>

        {/* Demo Button */}
        <div className="flex gap-2">
          <button
            onClick={generateDemoSignal}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors"
          >
            Generate Demo Signal
          </button>
          <p className="text-sm text-muted-foreground flex items-center">
            Click to simulate a trading signal for demo purposes
          </p>
        </div>

        {/* Metrics */}
        <section>
          <MetricsDisplay />
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Agent Status */}
          <div className="lg:col-span-1">
            <AgentStatusPanel />
          </div>

          {/* Middle Column - Signal Feed */}
          <div className="lg:col-span-2">
            <SignalFeed />
          </div>
        </div>

        {/* Execution Log */}
        <section>
          <ExecutionLog />
        </section>

        {/* Footer Info */}
        <div className="border-t border-border pt-6">
          <p className="text-xs text-muted-foreground text-center">
            AI Trading System • Real-time Multi-Agent Orchestration • 
            <span className={`ml-2 ${api.isConnected ? 'text-green-400' : 'text-red-400'}`}>
              Status: {api.isConnected ? 'Connected ✓' : 'Disconnected ✗'}
            </span>
          </p>
        </div>
      </div>
    </main>
  )
}
