'use client'

import { Card, CardContent, CardHeader, CardTitle } from './card'
import { useStore } from '../store'
import { TrendingUp, TrendingDown, Target } from 'lucide-react'

export function MetricsDisplay() {
  const { signals, winRate, portfolioPerformance } = useStore()

  const totalSignals = signals.length
  const buySignals = signals.filter(s => s.type === 'BUY').length
  const sellSignals = signals.filter(s => s.type === 'SELL').length
  const avgConfidence = signals.length > 0
    ? (signals.reduce((acc, s) => acc + s.confidence, 0) / signals.length * 100)
    : 0

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{totalSignals}</div>
          <p className="text-xs text-muted-foreground mt-1">Generated today</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" /> Buy Signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-500">{buySignals}</div>
          <p className="text-xs text-muted-foreground mt-1">{((buySignals/totalSignals)*100 || 0).toFixed(1)}% of total</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" /> Sell Signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-500">{sellSignals}</div>
          <p className="text-xs text-muted-foreground mt-1">{((sellSignals/totalSignals)*100 || 0).toFixed(1)}% of total</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" /> Avg Confidence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{avgConfidence.toFixed(0)}%</div>
          <p className="text-xs text-muted-foreground mt-1">Signal quality</p>
        </CardContent>
      </Card>
    </div>
  )
}
