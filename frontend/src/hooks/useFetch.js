import { useEffect, useState } from 'react'
import { ApiError } from '../lib/api.js'

// eslint-disable-next-line react-hooks/exhaustive-deps
export function useFetch(fetcher, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null })

  useEffect(() => {
    let active = true
    setState({ data: null, loading: true, error: null })

    fetcher()
      .then((data) => {
        if (!active) return
        setState({ data, loading: false, error: null })
      })
      .catch((err) => {
        if (!active) return
        setState({
          data: null,
          loading: false,
          error: err instanceof ApiError ? err.message : '取得に失敗しました',
        })
      })

    return () => {
      active = false
    }
  }, deps)

  function setData(updater) {
    setState((prev) => ({
      ...prev,
      data: typeof updater === 'function' ? updater(prev.data) : updater,
    }))
  }

  return { ...state, setData }
}
