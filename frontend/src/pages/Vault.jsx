import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listVaultEntries, deleteVaultEntry } from '../api/vault.js'
import { useVault } from '../hooks/useVault.jsx'
import { decryptJson } from '../lib/vaultCrypto.js'
import { ApiError } from '../lib/api.js'

export const CREDENTIAL_LABELS = {
  email: 'メールアドレス',
  memberId: '会員番号',
  phone: '電話番号',
}

function Vault() {
  const navigate = useNavigate()
  const { key, lock } = useVault()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [revealed, setRevealed] = useState(() => new Set())
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)

    listVaultEntries()
      .then(async (body) => {
        // 1件でも壊れていた場合に一覧全体が見えなくなるのを避けるため、件ごとに扱う
        const decrypted = await Promise.all(
          body.entries.map(async (entry) => {
            try {
              return { id: entry.id, data: await decryptJson(key, entry.iv, entry.cipherText) }
            } catch {
              return { id: entry.id, data: null }
            }
          }),
        )
        if (!active) return
        decrypted.sort((a, b) => (a.data?.siteName ?? '').localeCompare(b.data?.siteName ?? '', 'ja'))
        setEntries(decrypted)
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof ApiError ? err.message : '保管庫の読み込みに失敗しました')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [key])

  function toggleReveal(id) {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function copyToClipboard(value) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      setError('クリップボードにコピーできませんでした')
    }
  }

  async function handleDelete(id) {
    if (deletingId) return
    if (!window.confirm('この項目を削除しますか?')) return

    setDeletingId(id)
    setError(null)
    try {
      await deleteVaultEntry(id)
      setEntries((prev) => prev.filter((entry) => entry.id !== id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }

  function handleLock() {
    lock()
    navigate('/vault/unlock', { replace: true })
  }

  return (
    <main>
      <p>
        <Link to="/">ホームに戻る</Link>
      </p>
      <h1>パスワード管理</h1>

      <div className="vault-toolbar">
        <Link className="btn-primary" to="/vault/new">新しく登録する</Link>
        <button className="btn-secondary" type="button" onClick={handleLock}>
          ロックする
        </button>
      </div>

      {loading && <p>読み込み中...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && entries.length === 0 && <p>登録された認証情報はありません。</p>}

      {entries.length > 0 && (
        <ul className="grid vault-list">
          {entries.map(({ id, data }) => (
            <li className="card vault-card" key={id}>
              {data === null ? (
                <p role="alert">この項目は復号できませんでした。</p>
              ) : (
                <>
                  <h2>{data.siteName}</h2>
                  {data.siteUrl && (
                    <p>
                      <a href={data.siteUrl} target="_blank" rel="noreferrer">
                        {data.siteUrl}
                      </a>
                    </p>
                  )}
                  <p>
                    {CREDENTIAL_LABELS[data.credentialType] ?? data.credentialType}: {data.credentialValue}
                    <button className="btn-secondary" type="button" onClick={() => copyToClipboard(data.credentialValue)}>
                      コピー
                    </button>
                  </p>
                  <p>
                    パスワード: {revealed.has(id) ? data.password : '••••••••'}
                    <button className="btn-secondary" type="button" onClick={() => toggleReveal(id)}>
                      {revealed.has(id) ? '隠す' : '表示'}
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => copyToClipboard(data.password)}>
                      コピー
                    </button>
                  </p>
                  {data.note && <p>{data.note}</p>}
                  <Link className="btn-secondary" to={`/vault/${id}/edit`}>編集</Link>
                </>
              )}
              <button className="btn-secondary" type="button" onClick={() => handleDelete(id)} disabled={deletingId === id}>
                {deletingId === id ? '削除中...' : '削除'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default Vault
