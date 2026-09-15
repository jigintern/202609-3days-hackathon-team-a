import { apiFetch } from '../lib/api.js'

export function getHome() {
  return apiFetch('/api/home')
}
