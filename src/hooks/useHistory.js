import { useState, useCallback } from 'react'
import { loadHistory, addToHistory, clearHistory, saveHistory } from '../lib/storage'

export function useHistory() {
  const [history, setHistory] = useState(() => loadHistory())

  const reload = useCallback(() => {
    setHistory(loadHistory())
  }, [])

  const add = useCallback((media) => {
    const next = addToHistory(media)
    setHistory(next)
  }, [])

  const remove = useCallback((id) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id)
      saveHistory(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    clearHistory()
    setHistory([])
  }, [])

  return { history, add, remove, clear, reload }
}
