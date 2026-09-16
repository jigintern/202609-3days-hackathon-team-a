import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listVaultEntries, createVaultEntry, updateVaultEntry } from '../api/vault.js'
import { useVault } from '../hooks/useVault.jsx'
import { encryptJson, decryptJson } from '../lib/vaultCrypto.js'
import { CREDENTIAL_LABELS } from './Vault.jsx'
import { ApiError } from '../lib/api.js'

const CREDENTIAL_INPUT_TYPES = {
  email: 'email',
  memberId: 'text',
  phone: 'tel',
}

// 暗号文はサーバー側で8KBまで。各欄に上限を設けて超過を防ぐ(docs/VAULT_API.md 7)
const NOTE_MAX_LENGTH = 500

const EMPTY_FORM = {
  siteName: '',
  siteUrl: '',
  credentialType: 'email',
  credentialValue: '',
  password: '',
  note: '',
}

function VaultEntryForm() {
  const { entryId } = useParams()
  const navigate = useNavigate()
  const { key } = useVault()
  const isEdit = Boolean(entryId)

  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(isEdit)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit) return

    let active = true
    listVaultEntries()
      .then(async (body) => {
        const entry = body.entries.find((item) => item.id === entryId)
        if (!entry) throw new Error('not-found')
        const data = await decryptJson(key, entry.iv, entry.cipherText)
        if (!active) return
        setForm({ ...EMPTY_FORM, ...data })
        setLoadFailed(false)
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        // 空のフォームを出すと、保存時に既存の内容を空で上書きしてしまう
        setLoadFailed(true)
        setError(err instanceof ApiError ? err.message : '項目の読み込みに失敗しました')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [entryId, isEdit, key])

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    setSaving(true)
    setError(null)
    try {
      // 更新時も新しいIVで暗号化し直す(docs/VAULT_API.md 1.2)
      const payload = await encryptJson(key, {
        siteName: form.siteName.trim(),
        siteUrl: form.siteUrl.trim() || undefined,
        credentialType: form.credentialType,
        credentialValue: form.credentialValue.trim(),
        password: form.password,
        note: form.note.trim() || undefined,
      })

      if (isEdit) await updateVaultEntry(entryId, payload)
      else await createVaultEntry(payload)

      navigate('/vault', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>読み込み中...</p>

  if (loadFailed) {
    return (
      <main>
        <p>
          <Link to="/vault">一覧に戻る</Link>
        </p>
        <p role="alert">{error}</p>
      </main>
    )
  }

  const canSubmit =
    form.siteName.trim() && form.credentialValue.trim() && form.password && !saving

  return (
    <main>
      <p>
        <Link to="/vault">一覧に戻る</Link>
      </p>
      <h1>{isEdit ? '認証情報を編集' : '認証情報を登録'}</h1>
      <p>
        <small>デモでは実在のアカウント情報を入力せず、ダミーデータを使ってください。</small>
      </p>

      {error && <p role="alert">{error}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="siteName">サイト名(必須)</label>
          <input
            id="siteName"
            value={form.siteName}
            onChange={(e) => updateField('siteName', e.target.value)}
            maxLength={100}
            required
          />
        </div>
        <div>
          <label htmlFor="siteUrl">サイトのURL</label>
          <input
            id="siteUrl"
            type="url"
            value={form.siteUrl}
            onChange={(e) => updateField('siteUrl', e.target.value)}
            maxLength={300}
          />
        </div>

        <fieldset>
          <legend>認証情報の種別</legend>
          {Object.entries(CREDENTIAL_LABELS).map(([type, label]) => (
            <label key={type}>
              <input
                type="radio"
                name="credentialType"
                value={type}
                checked={form.credentialType === type}
                onChange={(e) => updateField('credentialType', e.target.value)}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div>
          <label htmlFor="credentialValue">
            {CREDENTIAL_LABELS[form.credentialType]}(必須)
          </label>
          <input
            id="credentialValue"
            type={CREDENTIAL_INPUT_TYPES[form.credentialType]}
            value={form.credentialValue}
            onChange={(e) => updateField('credentialValue', e.target.value)}
            maxLength={100}
            required
          />
        </div>
        <div>
          <label htmlFor="password">パスワード(必須)</label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            maxLength={200}
            autoComplete="off"
            required
          />
        </div>
        <div>
          <label htmlFor="note">備考({form.note.length} / {NOTE_MAX_LENGTH})</label>
          <textarea
            id="note"
            value={form.note}
            onChange={(e) => updateField('note', e.target.value)}
            maxLength={NOTE_MAX_LENGTH}
            rows={3}
          />
        </div>

        <button type="submit" disabled={!canSubmit}>
          {saving ? '保存中...' : '保存'}
        </button>
      </form>
    </main>
  )
}

export default VaultEntryForm
