import { apiFetch } from '../lib/api.js'

export function getVaultProfile() {
  return apiFetch('/api/vault/profile')
}

export function createVaultProfile(payload) {
  return apiFetch('/api/vault/profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listVaultEntries() {
  return apiFetch('/api/vault/entries')
}

export function createVaultEntry({ iv, cipherText }) {
  return apiFetch('/api/vault/entries', {
    method: 'POST',
    body: JSON.stringify({ iv, cipherText }),
  })
}

export function updateVaultEntry(entryId, { iv, cipherText }) {
  return apiFetch(`/api/vault/entries/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify({ iv, cipherText }),
  })
}

export function deleteVaultEntry(entryId) {
  return apiFetch(`/api/vault/entries/${entryId}`, { method: 'DELETE' })
}

/// 保管庫ごと削除する。マスターパスワードを忘れた場合の唯一の復旧手段
export function destroyVault() {
  return apiFetch('/api/vault', { method: 'DELETE' })
}
