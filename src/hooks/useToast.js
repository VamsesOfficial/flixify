import { useState, useRef, useCallback } from 'react'

export function useToast() {
  const [toast, setToast] = useState({ msg: '', visible: false })
  const timerRef = useRef(null)

  const show = useCallback((msg, duration = 2400) => {
    clearTimeout(timerRef.current)
    setToast({ msg, visible: true })
    timerRef.current = setTimeout(() => setToast({ msg: '', visible: false }), duration)
  }, [])

  return { toast, show }
}
