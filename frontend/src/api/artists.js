import { apiFetch } from '../lib/api.js'

export function getArtists() {
  return apiFetch('/api/artists')
}

export function getArtist(artistId) {
  return apiFetch(`/api/artists/${artistId}`)
}

export function getArtistEvents(artistId, scope = 'upcoming') {
  return apiFetch(`/api/artists/${artistId}/events?scope=${scope}`)
}

export function followArtist(artistId) {
  return apiFetch(`/api/artists/${artistId}/follow`, { method: 'POST' })
}

export function unfollowArtist(artistId) {
  return apiFetch(`/api/artists/${artistId}/follow`, { method: 'DELETE' })
}
