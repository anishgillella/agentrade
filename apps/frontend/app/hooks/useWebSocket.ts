'use client'

import { useEffect, useState, useRef } from 'react'
import { useStore, type Signal } from '../store'

// Convert http:// to ws:// for WebSocket URL
function getWebSocketURL(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  return apiUrl.replace(/^http/, 'ws')
}

const WS_URL = getWebSocketURL()

interface WSMessage {
  type: string
  data: any
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<any>(null)
  const store = useStore()
  const attemptsRef = useRef(0)

  useEffect(() => {
    // Dynamically import socket.io client only on client side
    if (typeof window === 'undefined') return

    let isMounted = true

    const initWebSocket = async () => {
      try {
        console.log('Initializing WebSocket connection to:', WS_URL)
        
        // Use dynamic import to avoid SSR issues
        const { io } = await import('socket.io-client')
        
        socketRef.current = io(WS_URL, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 10,
          forceNew: false,
          secure: WS_URL.startsWith('wss'),
          rejectUnauthorized: false,
        })

        // Connection events
        socketRef.current.on('connect', () => {
          if (isMounted) {
            console.log('✓ WebSocket connected:', socketRef.current.id)
            setIsConnected(true)
            setError(null)
            attemptsRef.current = 0
            socketRef.current.emit('signals:subscribe')
          }
        })

        socketRef.current.on('disconnect', (reason: string) => {
          if (isMounted) {
            console.log('✗ WebSocket disconnected:', reason)
            setIsConnected(false)
          }
        })

        socketRef.current.on('connect_error', (err: any) => {
          if (isMounted) {
            console.error('WebSocket error:', err.message)
            setError(err.message || 'Connection error')
            attemptsRef.current++
          }
        })

        // Signal events
        socketRef.current.on('signals:initial', (signals: Signal[]) => {
          if (isMounted) {
            console.log('Received initial signals:', signals.length)
            signals.forEach(signal => {
              store.addSignal({
                ...signal,
                timestamp: new Date(signal.timestamp),
              })
            })
          }
        })

        socketRef.current.on('signal:new', (signal: Signal) => {
          if (isMounted) {
            console.log('New signal received:', signal.ticker)
            store.addSignal({
              ...signal,
              timestamp: new Date(signal.timestamp),
            })
          }
        })

        // Agent status events
        socketRef.current.on('agent:status', (data: any) => {
          if (isMounted) {
            store.updateAgentStatus(data.agentId, data.status)
          }
        })

        // Execution log events
        socketRef.current.on('execution:log', (execution: any) => {
          if (isMounted) {
            store.addExecution({
              ...execution,
              timestamp: new Date(execution.timestamp),
            })
          }
        })
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'WebSocket connection failed'
          console.error('WebSocket init error:', message)
          setError(message)
        }
      }
    }

    initWebSocket()

    return () => {
      isMounted = false
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [store])

  return {
    isConnected,
    error,
    socket: socketRef.current,
  }
}
