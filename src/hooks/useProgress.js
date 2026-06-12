import { useState, useCallback } from 'react'
import { loadProgress, saveProgress } from '../lib/storage'

export function useProgress() {
  const [progress, setProgress] = useState(() => loadProgress())

  const reload = useCallback(() => {
    setProgress(loadProgress())
  }, [])

  const update = useCallback((data) => {
    setProgress((prev) => {
      const next = { ...prev, ...data }
      saveProgress(next)
      return next
    })
  }, [])

  const getContinueItems = useCallback(() => {
    return Object.values(progress).filter(
      (p) => p.progress && p.progress.watched > 5 && p.progress.watched < p.progress.duration * 0.95
    )
  }, [progress])

  return { progress, update, getContinueItems, reload }
}
