import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { STATE_VERSION } from './default-config'
import { createInitialState } from './state'

const STORAGE_KEY = 'smart-campus-network/v1'
const NetworkContext = createContext(null)

export function NetworkProvider({ children }) {
  const [network, setNetworkState] = useState(createInitialState)
  const [history, setHistory] = useState([])
  const [hydrated, setHydrated] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const counter = useRef(0)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.version === STATE_VERSION && parsed.network?.version === STATE_VERSION) {
          setNetworkState(parsed.network)
          setHistory(Array.isArray(parsed.history) ? parsed.history : [])
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const payload = { version: STATE_VERSION, network, history: history.slice(-200) }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    setSavedAt(Date.now())
  }, [network, history, hydrated])

  const setNetwork = useCallback((next) => {
    setNetworkState((prev) => (typeof next === 'function' ? next(prev) : next))
  }, [])

  const resetNetwork = useCallback(() => setNetworkState(createInitialState()), [])

  const record = useCallback((r) => {
    counter.current += 1
    setHistory((h) => [...h, { ...r, id: `${Date.now()}-${counter.current}`, at: Date.now() }])
  }, [])

  const clearHistory = useCallback(() => setHistory([]), [])

  const value = useMemo(
    () => ({ network, setNetwork, resetNetwork, history, record, clearHistory, hydrated, savedAt }),
    [network, setNetwork, resetNetwork, history, record, clearHistory, hydrated, savedAt],
  )
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetwork() {
  const ctx = useContext(NetworkContext)
  if (!ctx) throw new Error('useNetwork must be used inside NetworkProvider')
  return ctx
}
