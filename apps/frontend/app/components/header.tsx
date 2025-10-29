'use client'

import { Zap } from 'lucide-react'
import { Badge } from './badge'
import { useStore, type Personality } from '../store'

const PERSONALITIES = {
  buffett: { label: 'Warren Buffett', color: 'bg-blue-600' },
  soros: { label: 'George Soros', color: 'bg-purple-600' },
  elon: { label: 'Elon Musk', color: 'bg-cyan-600' },
  munger: { label: 'Charlie Munger', color: 'bg-red-600' },
}

export function Header() {
  const { personality, setPersonality } = useStore()

  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-accent p-2">
            <Zap className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Trading System</h1>
            <p className="text-xs text-muted-foreground">Real-time Multi-Agent Orchestration</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Active Personality</p>
            <div className="flex gap-2">
              {(Object.keys(PERSONALITIES) as Personality[]).map((pers) => (
                <button
                  key={pers}
                  onClick={() => setPersonality(pers)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    personality === pers
                      ? `${PERSONALITIES[pers].color} text-white shadow-lg`
                      : 'bg-secondary text-muted-foreground hover:bg-border'
                  }`}
                >
                  {PERSONALITIES[pers].label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
