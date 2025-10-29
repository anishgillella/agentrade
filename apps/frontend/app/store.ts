import { create } from 'zustand'

export type Personality = 'buffett' | 'soros' | 'cathie' | 'contrarian'
export type AgentStatus = 'active' | 'processing' | 'idle' | 'error'
export type SignalType = 'BUY' | 'SELL' | 'HOLD'

export interface Signal {
  id: string
  ticker: string
  type: SignalType
  confidence: number
  sentiment: number
  timestamp: Date
  newsAgentRecommendation: string
  newsSummary?: string
  investmentAgentReasoning?: string
  personalityReasoning?: string
  personalityVeto?: boolean
  personalityModification?: string
  executionTime: number
}

export interface Agent {
  id: string
  name: string
  status: AgentStatus
  lastUpdate: Date
  errorMessage?: string
}

export interface Execution {
  id: string
  timestamp: Date
  agentName: string
  action: string
  input: string
  output: string
  status: 'success' | 'error'
  duration: number
}

export interface Store {
  personality: Personality
  setPersonality: (personality: Personality) => void
  
  signals: Signal[]
  addSignal: (signal: Signal) => void
  clearSignals: () => void
  
  agents: Record<string, Agent>
  updateAgentStatus: (agentId: string, status: AgentStatus, error?: string) => void
  
  executions: Execution[]
  addExecution: (execution: Execution) => void
  
  winRate: number
  updateWinRate: (rate: number) => void
  
  portfolioPerformance: number
  updatePortfolioPerformance: (performance: number) => void
}

export const useStore = create<Store>((set) => ({
  personality: 'buffett',
  setPersonality: (personality) => set({ personality }),
  
  signals: [],
  addSignal: (signal) => set((state) => ({
    signals: [signal, ...state.signals].slice(0, 100), // Keep last 100
  })),
  clearSignals: () => set({ signals: [] }),
  
  agents: {
    'news-agent': { id: 'news-agent', name: 'News Agent', status: 'idle', lastUpdate: new Date() },
    'investment-agent': { id: 'investment-agent', name: 'Investment Agent', status: 'idle', lastUpdate: new Date() },
    'personality-agent': { id: 'personality-agent', name: 'Personality Agent', status: 'idle', lastUpdate: new Date() },
  },
  updateAgentStatus: (agentId, status, error) => set((state) => ({
    agents: {
      ...state.agents,
      [agentId]: {
        ...state.agents[agentId],
        status,
        lastUpdate: new Date(),
        errorMessage: error,
      },
    },
  })),
  
  executions: [],
  addExecution: (execution) => set((state) => ({
    executions: [execution, ...state.executions].slice(0, 50), // Keep last 50
  })),
  
  winRate: 0,
  updateWinRate: (rate) => set({ winRate: rate }),
  
  portfolioPerformance: 0,
  updatePortfolioPerformance: (performance) => set({ portfolioPerformance: performance }),
}))
