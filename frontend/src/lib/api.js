import { supabase } from './supabase.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  // クールダウンの retryAfter など、エラー本文に付く追加情報も受け取れるようにする
  constructor(status, code, message, details = {}) {
    super(message)
    this.status = status
    this.code = code
    this.retryAfter = details.retryAfter
  }
}

export async function apiFetch(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code,
      body?.error?.message ?? 'リクエストに失敗しました',
      body?.error ?? {},
    )
  }

  return body
}
