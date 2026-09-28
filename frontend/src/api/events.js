import { apiFetch } from '../lib/api.js'

export function getEvent(eventId) {
  return apiFetch(`/api/events/${eventId}`)
}
