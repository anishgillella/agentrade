'use client'

import { Badge } from './badge'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { useStore } from '../store'
import { Activity, AlertCircle, Loader } from 'lucide-react'

export function AgentStatusPanel() {
  const { agents } = useStore()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/50'
      case 'processing':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'idle':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50'
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Activity className="h-4 w-4" />
      case 'processing':
        return <Loader className="h-4 w-4 animate-spin" />
      case 'error':
        return <AlertCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Agent Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.values(agents).map((agent) => (
            <div key={agent.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-sm">{agent.name}</p>
                {agent.errorMessage && (
                  <p className="text-xs text-red-400 mt-1">{agent.errorMessage}</p>
                )}
              </div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded border ${getStatusColor(agent.status)}`}>
                {getStatusIcon(agent.status)}
                <span className="text-xs font-medium capitalize">{agent.status}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
