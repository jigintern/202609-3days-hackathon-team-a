import { apiFetch } from '../lib/api.js'

export function listPosts(eventId, { type = 'fan', sort, cursor } = {}) {
  const params = new URLSearchParams({ type })
  if (sort) params.set('sort', sort)
  if (cursor) params.set('cursor', cursor)
  return apiFetch(`/api/events/${eventId}/posts?${params.toString()}`)
}

export function createPost(eventId, { body, imageUrls } = {}) {
  return apiFetch(`/api/events/${eventId}/posts`, {
    method: 'POST',
    body: JSON.stringify({ body, imageUrls }),
  })
}
