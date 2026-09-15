import { apiFetch } from '../lib/api.js'

export function createEventRequest({ artistName, title, venue, startsAt, note }) {
  return apiFetch('/api/event-requests', {
    method: 'POST',
    body: JSON.stringify({ artistName, title, venue, startsAt, note }),
  })
}

export function listMyEventRequests() {
  return apiFetch('/api/event-requests/mine')
}
