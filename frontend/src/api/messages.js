import { apiFetch } from '../lib/api.js'

export function listMessages(eventId, { after, deletedSince } = {}) {
  const params = new URLSearchParams()
  if (after) params.set('after', after)
  if (deletedSince) params.set('deletedSince', deletedSince)
  const query = params.toString()
  return apiFetch(`/api/events/${eventId}/messages${query ? `?${query}` : ''}`)
}

export function createMessage(eventId, { body } = {}) {
  return apiFetch(`/api/events/${eventId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}

export function deleteMessage(messageId) {
  return apiFetch(`/api/messages/${messageId}`, { method: 'DELETE' })
}
