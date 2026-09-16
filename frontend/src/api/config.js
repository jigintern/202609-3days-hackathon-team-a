import { apiFetch } from '../lib/api.js'

export function getConfig() {
  return apiFetch('/api/config')
}
