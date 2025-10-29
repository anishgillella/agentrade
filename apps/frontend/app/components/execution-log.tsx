'use client'

import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { useStore } from '../store'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, XCircle } from 'lucide-react'

export function ExecutionLog() {
  const { executions } = useStore()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Execution Audit Trail</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {executions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No executions yet. Waiting for agent actions...</p>
            </div>
          ) : (
            executions.map((execution) => (
              <div
                key={execution.id}
                className="p-3 border border-border rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {execution.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <p className="font-medium text-sm">{execution.agentName}</p>
                      <Badge variant={execution.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                        {execution.status === 'success' ? 'Success' : 'Error'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(execution.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono bg-background/50 px-2 py-1 rounded">
                      {execution.duration}ms
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <div>
                    <p className="text-muted-foreground font-medium">Action</p>
                    <p className="text-slate-300 font-mono truncate">{execution.action}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium">Result</p>
                    <p className="text-slate-300 font-mono truncate">
                      {execution.status === 'success' ? 'Completed' : execution.output}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
