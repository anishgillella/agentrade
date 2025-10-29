'use client'

import { useEffect } from 'react'
import { useStore, type Signal, type Execution } from '../store'

// Realistic news headlines
const newsHeadlines: Record<string, string[]> = {
  AAPL: [
    'Apple Q4 earnings beat expectations with strong iPhone 16 sales. Analysts raise price targets.',
    'Apple announces new AI features in upcoming iOS update. Stock rallies on innovation news.',
    'iPhone 16 pre-orders exceed expectations. Supply chain strengthens.',
  ],
  GOOGL: [
    'Google Cloud revenue grows 35% YoY. New AI partnerships announced.',
    'Alphabet invests $60B in AI infrastructure. Market reacts positively.',
    'Google releases new AI model beating competitors on benchmarks.',
  ],
  MSFT: [
    'Microsoft Azure AI adoption accelerates. Enterprise spending increases 28%.',
    'Microsoft Copilot integration drives cloud growth.',
    'Enterprise AI demand propels Microsoft to new heights.',
  ],
  TESLA: [
    'Tesla deliveries exceed estimates. Stock rallies on positive numbers.',
    'Tesla Cybertruck production ramps up faster than expected.',
    'Tesla announces new battery technology breakthrough.',
  ],
  BTC: [
    'Bitcoin breaks above $70k on institutional inflows. Spot ETF sees record purchases.',
    'Federal Reserve signals pause in rate hikes. Bitcoin surges.',
    'Major bank adopts Bitcoin holdings. Crypto market rallies.',
  ],
  ETH: [
    'Ethereum staking rewards hit new highs. Network activity increases with Layer 2.',
    'Ethereum Shanghai upgrade improves transaction speed 40%.',
    'Enterprise adoption of Ethereum accelerates.',
  ],
}

const investmentAnalysis: Record<string, Record<string, string>> = {
  BUY: {
    technical: 'Strong technical breakout above key resistance. Volume surge indicates institutional buying.',
    momentum: 'Positive momentum detected with price making higher highs and higher lows.',
    macro: 'Fundamental support with positive macro catalysts aligned.',
  },
  SELL: {
    technical: 'Bearish divergence on daily chart. Price rejecting resistance repeatedly.',
    momentum: 'Momentum fading as oscillators show overbought conditions.',
    macro: 'Headwinds from macro environment suggest profit-taking.',
  },
  HOLD: {
    technical: 'Consolidation phase within established trading range.',
    momentum: 'Mixed signals - waiting for directional confirmation.',
    macro: 'Macro picture unclear - holding current position until clarity.',
  },
}

const personalityStrategies: Record<string, Record<string, { strategy: string; history: string }>> = {
  buffett: {
    BUY: {
      strategy: 'Fundamentals are solid with strong competitive moat. Long-term hold for value accumulation.',
      history: 'Based on Buffett\'s 74% win rate on fundamental plays. Similar signal to Apple 2020 trade (+182% return). Risk/reward ratio favorable at 1:3.2.',
    },
    SELL: {
      strategy: 'Valuation has become excessive. Wait for pullback to reasonable levels.',
      history: 'Buffett history shows 71% accuracy on overvaluation exits. Previous similar signal avoided 28% drawdown.',
    },
    HOLD: {
      strategy: 'Position being monitored for quarterly earnings confirmation.',
      history: 'Buffett portfolio holds average 6.2 years. Patience strategy has 79% success rate on value accumulation.',
    },
  },
  soros: {
    BUY: {
      strategy: 'Market inflection detected. Momentum favors breakout traders in this cycle.',
      history: 'Soros momentum trades show 68% win rate. Last similar signal: +12% in 3 days. Reflexivity pattern confirmed.',
    },
    SELL: {
      strategy: 'Technical exhaustion suggests profit-taking opportunity now.',
      history: 'Soros profit-taking signals average 73% accuracy. Typical exit gain: 8.4%. Avoid 65% of major pullbacks.',
    },
    HOLD: {
      strategy: 'Waiting for clearer directional bias from market dynamics.',
      history: 'Soros holds during uncertainty avg 2-3 days. Win rate: 64%. Reflexivity loop still developing.',
    },
  },
  cathie: {
    BUY: {
      strategy: 'Disruptive innovation story with secular growth tailwinds. AI adoption metrics accelerating.',
      history: 'Cathie AI plays: 81% win rate (highest). Tesla similar signal: +287% over 18mo. Conviction level: 9.2/10.',
    },
    SELL: {
      strategy: 'Valuation stretched relative to growth prospects. Redeploying to better risk/reward.',
      history: 'Cathie exit discipline: 61% avoid further downside. Tech rotation trade: +4.2% avg gain on exits.',
    },
    HOLD: {
      strategy: 'Core innovation exposure maintained. Monitoring AI revenue penetration.',
      history: 'Cathie 5-year hold strategy: 156% CAGR. Current thesis strength: 8.7/10. Conviction increasing.',
    },
  },
  contrarian: {
    BUY: {
      strategy: 'Crowd is bearish - classic contrarian setup. Capitulation signals often precede rallies.',
      history: 'Contrarian capitulation plays: 76% win rate. Fear index correlation 0.89. Average subsequent rally: +18.3% in 30 days.',
    },
    SELL: {
      strategy: 'Euphoria and FOMO at extreme levels. Contrarian signal to lock in profits.',
      history: 'Contrarian euphoria exits: 79% accuracy. Prevents average 22.5% drawdowns. Greed index reading extreme.',
    },
    HOLD: {
      strategy: 'Sentiment indicators mixed. Waiting for more extreme readings.',
      history: 'Contrarian waiting strategy: 58% leads to better entries. Sentiment extremes developing in 4-7 days historically.',
    },
  },
}

export function useAutoSignalGenerator() {
  const { addSignal, addExecution, updateAgentStatus } = useStore()

  useEffect(() => {
    // Auto-generate signals every 12 seconds (3 agents × 4 sec each)
    const autoInterval = setInterval(() => {
      generateRealisticSignal()
    }, 12000)

    return () => clearInterval(autoInterval)
  }, [])

  const generateRealisticSignal = () => {
    const tickers = ['AAPL', 'GOOGL', 'MSFT', 'TESLA', 'BTC', 'ETH']
    const types = ['BUY', 'SELL', 'HOLD'] as const
    const selectedTicker = tickers[Math.floor(Math.random() * tickers.length)]
    const selectedType = types[Math.floor(Math.random() * types.length)]
    const personality = useStore.getState().personality

    const startTime = Date.now()

    // Phase 1: News Agent (0-3 seconds)
    updateAgentStatus('news-agent', 'active')
    updateAgentStatus('investment-agent', 'idle')
    updateAgentStatus('personality-agent', 'idle')

    const newsHeadline = newsHeadlines[selectedTicker][
      Math.floor(Math.random() * newsHeadlines[selectedTicker].length)
    ]

    setTimeout(() => {
      // Phase 2: Investment Agent (3-7 seconds)
      updateAgentStatus('news-agent', 'idle')
      updateAgentStatus('investment-agent', 'processing')
      updateAgentStatus('personality-agent', 'idle')

      const investmentReasoning = Object.values(investmentAnalysis[selectedType]).join(' ')

      setTimeout(() => {
        // Phase 3: Personality Agent (7-10 seconds)
        updateAgentStatus('news-agent', 'idle')
        updateAgentStatus('investment-agent', 'idle')
        updateAgentStatus('personality-agent', 'processing')

        const personalityReasoning = personalityStrategies[personality][selectedType]

        setTimeout(() => {
          // Phase 4: Complete - Signal generated
          updateAgentStatus('news-agent', 'idle')
          updateAgentStatus('investment-agent', 'idle')
          updateAgentStatus('personality-agent', 'idle')

          const executionTime = Date.now() - startTime

          const signal: Signal = {
            id: Math.random().toString(36).substr(2, 9),
            ticker: selectedTicker,
            type: selectedType,
            confidence: Math.random() * 0.25 + 0.7, // 70-95%
            sentiment: Math.random() * 0.6 - 0.3, // -30% to +30%
            timestamp: new Date(),
            newsAgentRecommendation: `Analyzed ${newsHeadline.substring(0, 50)}...`,
            newsSummary: newsHeadline,
            investmentAgentReasoning: investmentReasoning,
            personalityReasoning: `${personalityReasoning.strategy}\n\n${personalityReasoning.history}`,
            personalityVeto: Math.random() > 0.9, // 10% chance of veto
            personalityModification: Math.random() > 0.8 ? 'Risk position size adjusted' : undefined,
            executionTime: executionTime,
          }

          addSignal(signal)

          // Add execution logs for each phase
          const newsExecution: Execution = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            agentName: 'News Agent',
            action: `Fetched ${newsHeadline.length} chars of news`,
            input: `${selectedTicker},sources:newsapi,reddit`,
            output: 'Articles fetched and scored',
            status: 'success',
            duration: 3000,
          }

          const investmentExecution: Execution = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(Date.now() + 3000),
            agentName: 'Investment Agent',
            action: `Analyzed ${selectedTicker} with technical+sentiment`,
            input: `price_data,news_sentiment,technical_indicators`,
            output: selectedType,
            status: 'success',
            duration: 4000,
          }

          const personalityExecution: Execution = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(Date.now() + 7000),
            agentName: 'Personality Agent',
            action: `Applied ${personality} personality filter`,
            input: `signal:${selectedType},personality:${personality}`,
            output: signal.personalityVeto ? 'VETO' : selectedType,
            status: 'success',
            duration: 3000,
          }

          addExecution(newsExecution)
          addExecution(investmentExecution)
          addExecution(personalityExecution)
        }, 3000) // Personality agent completes after 3 more seconds
      }, 4000) // Investment agent completes after 4 seconds
    }, 3000) // News agent completes after 3 seconds
  }
}
