import { supabase } from '../lib/supabase.js'
import { ApiError } from '../lib/api.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

// multipartではboundary付きのContent-Typeをブラウザに決めさせる必要があり、
// 常にapplication/jsonを付ける共通のapiFetchが使えないため個別に実装している
export async function uploadImages(files) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const form = new FormData()
  for (const file of files) {
    form.append('images', file)
  }

  const res = await fetch(`${API_BASE_URL}/api/uploads/images`, {
    method: 'POST',
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: form,
  })

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code,
      body?.error?.message ?? '画像のアップロードに失敗しました',
    )
  }

  return body
}
