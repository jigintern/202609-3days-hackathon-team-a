import { apiFetch, ApiError } from '../lib/api.js'
import { supabase } from '../lib/supabase.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

export function getUsers() {
  return apiFetch('/api/admin/users')
}

export function setUserSuspended(userId, isSuspended) {
  return apiFetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isSuspended }),
  })
}

export function getAdminPosts() {
  return apiFetch('/api/admin/posts')
}

export function deleteAdminPost(postId) {
  return apiFetch(`/api/admin/posts/${postId}`, { method: 'DELETE' })
}

export function getAdminMessages() {
  return apiFetch('/api/admin/messages')
}

export function deleteAdminMessage(messageId) {
  return apiFetch(`/api/admin/messages/${messageId}`, { method: 'DELETE' })
}

export function getAdminArtists(cursor) {
  return apiFetch(`/api/admin/artists${cursor ? `?cursor=${cursor}` : ''}`)
}

export function createArtist(artist) {
  return apiFetch('/api/admin/artists', { method: 'POST', body: JSON.stringify(artist) })
}

export function updateArtist(artistId, artist) {
  return apiFetch(`/api/admin/artists/${artistId}`, {
    method: 'PATCH',
    body: JSON.stringify(artist),
  })
}

// multipartではboundary付きのContent-Typeをブラウザに決めさせる必要があり、
// 常にapplication/jsonを付ける共通のapiFetchが使えないため個別に実装している
export async function uploadArtistImage(file) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const form = new FormData()
  form.append('image', file)

  const res = await fetch(`${API_BASE_URL}/api/admin/artists/upload-image`, {
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

export function getAdminEvents(cursor) {
  return apiFetch(`/api/admin/events${cursor ? `?cursor=${cursor}` : ''}`)
}

export function createEvent(event) {
  return apiFetch('/api/admin/events', { method: 'POST', body: JSON.stringify(event) })
}

export function updateEvent(eventId, event) {
  return apiFetch(`/api/admin/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(event),
  })
}

export function createOfficialPost(eventId, { body, imageUrls }) {
  return apiFetch(`/api/admin/events/${eventId}/official-posts`, {
    method: 'POST',
    body: JSON.stringify({ body, imageUrls }),
  })
}

export function getEventRequests(status) {
  const query = status ? `?status=${status}` : ''
  return apiFetch(`/api/admin/event-requests${query}`)
}

export function updateEventRequestStatus(requestId, status) {
  return apiFetch(`/api/admin/event-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
