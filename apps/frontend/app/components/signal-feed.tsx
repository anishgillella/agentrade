'use client'

import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { Progress } from './progress'
import { useStore } from '../store'
import { formatDistanceToNow } from 'date-fns'
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export function SignalFeed() {
  const { signals } = useStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const getSignalIcon = (type: string) => {
    switch (type) {
      case 'BUY':
        return <TrendingUp className="h-5 w-5 text-green-500" />
      case 'SELL':
        return <TrendingDown className="h-5 w-5 text-red-500" />
      default:
        return <Minus className="h-5 w-5 text-yellow-500" />
    }
  }

  const getSignalColor = (type: string) => {
    switch (type) {
      case 'BUY':
        return 'bg-green-500/10 border-green-500/30'
      case 'SELL':
        return 'bg-red-500/10 border-red-500/30'
      default:
        return 'bg-yellow-500/10 border-yellow-500/30'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Signal Feed</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {signals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No signals yet. Waiting for agents to generate recommendations...</p>
            </div>
          ) : (
            signals.map((signal) => (
              <div
                key={signal.id}
                className={`p-4 rounded-lg border ${getSignalColor(signal.type)}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    {getSignalIcon(signal.type)}
                    <div>
                      <p className="font-bold text-lg">{signal.ticker}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(signal.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="default">{signal.type}</Badge>
                    {signal.personalityVeto && (
                      <Badge variant="destructive">Vetoed</Badge>
                    )}
                  </div>
                </div>

                {/* Confidence & Sentiment */}
                <div className="space-y-2 mb-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Confidence</span>
                      <span className="text-xs font-medium">{(signal.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={signal.confidence * 100} />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Sentiment</span>
                      <span className="text-xs font-medium">
                        {signal.sentiment > 0 ? '+' : ''}{(signal.sentiment * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={Math.max(0, signal.sentiment * 100 + 50)} />
                  </div>
                </div>

                {/* Details Section */}
                <div className="pt-3 border-t border-border/30">
                  <button
                    onClick={() => setExpandedId(expandedId === signal.id ? null : signal.id)}
                    className="w-full flex items-center justify-between text-xs hover:text-accent transition-colors"
                  >
                    <span className="font-medium text-muted-foreground">View Details</span>
                    {expandedId === signal.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {expandedId === signal.id && (
                    <div className="mt-3 space-y-3 pt-3 border-t border-border/20">
                      {/* News Summary */}
                      {signal.newsSummary && (
                        <div className="bg-slate-900/50 p-3 rounded-lg">
                          <p className="text-xs font-medium text-accent mb-1">📰 Latest News</p>
                          <p className="text-xs text-slate-300 leading-relaxed">{signal.newsSummary}</p>
                        </div>
                      )}

                      {/* Investment Agent Reasoning */}
                      {signal.investmentAgentReasoning && (
                        <div className="bg-slate-900/50 p-3 rounded-lg">
                          <p className="text-xs font-medium text-cyan-400 mb-1">🤖 Investment Analysis</p>
                          <p className="text-xs text-slate-300 leading-relaxed">{signal.investmentAgentReasoning}</p>
                        </div>
                      )}

                      {/* Personality Reasoning */}
                      {signal.personalityReasoning && (
                        <div className="bg-slate-900/50 p-3 rounded-lg">
                          <p className="text-xs font-medium text-purple-400 mb-1">💡 Personality Strategy</p>
                          <p className="text-xs text-slate-300 leading-relaxed">{signal.personalityReasoning}</p>
                        </div>
                      )}

                      {/* Quick Summary */}
                      <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/20">
                        <span>News Agent: {signal.newsAgentRecommendation}</span>
                        <span>⏱ {signal.executionTime.toFixed(0)}ms</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
