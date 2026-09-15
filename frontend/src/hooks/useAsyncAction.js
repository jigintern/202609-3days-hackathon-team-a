import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../lib/api.js'

export function useAsyncAction(action) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const activeRef = useRef(true)

  useEffect(() => {
    // StrictModeは開発時にeffectを「実行→クリーンアップ→再実行」する。
    // ここで true に戻さないと、クリーンアップで false になったまま復帰せず、
    // finally の setPending(false) が動かずボタンが押せないままになる。
    activeRef.current = true

    return () => {
      activeRef.current = false
    }
  }, [])

  async function run(...args) {
    if (pending) return

    setError(null)
    setPending(true)
    try {
      await action(...args)
    } catch (err) {
      if (activeRef.current) {
        setError(err instanceof ApiError ? err.message : '操作に失敗しました')
      }
    } finally {
      if (activeRef.current) setPending(false)
    }
  }

  return { run, pending, error }
}
