'use client'

import { useEffect, useState, useCallback } from 'react'
import { useStore, type Signal } from '../store'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export function useApi() {
  const store = useStore()
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch all signals
  const fetchSignals = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/signals`)
      if (!response.ok) throw new Error('Failed to fetch signals')
      const data = await response.json()
      return data.signals as Signal[]
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return []
    }
  }, [])

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/metrics`)
      if (!response.ok) throw new Error('Failed to fetch metrics')
      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    }
  }, [])

  // Fetch agent status
  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/agents`)
      if (!response.ok) throw new Error('Failed to fetch agents')
      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    }
  }, [])

  // Change personality
  const changePersonality = useCallback(async (personality: string) => {
    try {
      const response = await fetch(`${API_URL}/api/personality`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personality }),
      })
      if (!response.ok) throw new Error('Failed to change personality')
      store.setPersonality(personality as any)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    }
  }, [store])

  // Health check
  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/health`)
      if (response.ok) {
        setIsConnected(true)
        setError(null)
        return true
      }
      return false
    } catch (err) {
      setIsConnected(false)
      setError('Backend not available')
      return false
    }
  }, [])

  // Initial health check
  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  return {
    isConnected,
    error,
    fetchSignals,
    fetchMetrics,
    fetchAgents,
    changePersonality,
    checkHealth,
  }
}
