import { useCallback, useState } from 'react'
import { createArtist, getAdminArtists, updateArtist, uploadArtistImage } from '../../api/admin.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAsyncAction } from '../../hooks/useAsyncAction.js'

const EMPTY = { name: '', nameKana: '', description: '', imageUrl: '' }

// 登録時は空欄を送らない。編集時は空欄も送らないと「値を消す」ができないため、
// 空文字のまま送ってサーバー側でnullに寄せてもらう。
function toPayload(form, { isEdit }) {
  const payload = {}
  for (const [key, value] of Object.entries(form)) {
    const trimmed = value.trim()
    if (trimmed || isEdit) payload[key] = trimmed
  }
  return payload
}

function AdminArtists() {
  const fetchArtists = useCallback(
    () => getAdminArtists().then((body) => ({ artists: body?.artists ?? [], nextCursor: body?.nextCursor ?? null })),
    [],
  )
  const { data, setData, loading, error } = useFetch(fetchArtists, [])
  const artists = data?.artists ?? []

  const { run: loadMore, pending: loadingMore, error: loadMoreError } = useAsyncAction(async () => {
    const body = await getAdminArtists(data.nextCursor)
    setData((prev) => ({
      artists: [...prev.artists, ...(body.artists ?? [])],
      nextCursor: body.nextCursor ?? null,
    }))
  })

  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)

  function startCreate() {
    setEditingId(null)
    setForm(EMPTY)
  }

  function startEdit(artist) {
    setEditingId(artist.id)
    setForm({
      name: artist.name ?? '',
      nameKana: artist.nameKana ?? '',
      description: artist.description ?? '',
      imageUrl: artist.imageUrl ?? '',
    })
  }

  const { run: uploadImage, pending: uploading, error: uploadError } = useAsyncAction(async (file) => {
    const body = await uploadArtistImage(file)
    setForm((prev) => ({ ...prev, imageUrl: body.url }))
  })

  const { run: submit, pending, error: actionError } = useAsyncAction(async () => {
    const payload = toPayload(form, { isEdit: Boolean(editingId) })

    if (editingId) {
      const body = await updateArtist(editingId, payload)
      setData((prev) => ({
        ...prev,
        artists: prev.artists.map((a) => (a.id === editingId ? { ...a, ...body.artist } : a)),
      }))
    } else {
      const body = await createArtist(payload)
      setData((prev) => ({
        ...prev,
        artists: [{ ...body.artist, eventCount: 0, followerCount: 0 }, ...prev.artists],
      }))
    }

    startCreate()
  })

  return (
    <>
      <h1 className="admin-title">
        アーティスト管理
        <span className="admin-badge">管理画面</span>
      </h1>

      <h2 className="admin-section">{editingId ? 'アーティストを編集' : 'アーティストを登録'}</h2>
      <form
        className="card admin-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label>
          名前
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={100}
          />
        </label>
        <label>
          よみがな
          <input
            value={form.nameKana}
            onChange={(e) => setForm({ ...form, nameKana: e.target.value })}
            maxLength={100}
          />
        </label>
        <label className="admin-form-wide">
          説明
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={1000}
          />
        </label>
        <label>
          画像URL
          <input
            type="url"
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://..."
          />
        </label>
        <label>
          画像をアップロード
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) uploadImage(file)
            }}
          />
        </label>
        {uploading && <p className="admin-form-wide">アップロード中...</p>}
        {uploadError && (
          <p className="admin-form-wide" role="alert">
            {uploadError}
          </p>
        )}
        {form.imageUrl && (
          <p className="admin-form-wide">
            <img src={form.imageUrl} alt="プレビュー" width={120} />
          </p>
        )}
        {actionError && <p className="admin-form-wide" role="alert">{actionError}</p>}
        <div className="admin-form-actions">
          <button type="submit" className="btn-primary" disabled={pending || !form.name.trim()}>
            {editingId ? '更新する' : '登録する'}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={startCreate} disabled={pending}>
              編集をやめる
            </button>
          )}
        </div>
      </form>

      <h2 className="admin-section">登録済みのアーティスト</h2>
      {error && <p role="alert">{error}</p>}
      {loading && <p>読み込み中...</p>}
      {!loading && !error && (
        <ul className="admin-list">
          {artists.map((artist) => (
            <li key={artist.id} className="card admin-list-item">
              <div className="admin-list-main">
                <p className="admin-list-body">
                  <strong>{artist.name}</strong>
                  {artist.nameKana && <span className="admin-note">（{artist.nameKana}）</span>}
                </p>
                <p className="admin-meta">
                  イベント{artist.eventCount ?? 0}件 ／ フォロワー{artist.followerCount ?? 0}人
                </p>
              </div>
              <div className="admin-actions">
                <button type="button" className="btn-secondary" onClick={() => startEdit(artist)}>
                  編集
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && artists.length === 0 && (
        <p className="admin-empty">まだ登録されていません。</p>
      )}
      {loadMoreError && <p role="alert">{loadMoreError}</p>}
      {data?.nextCursor && (
        <div className="admin-more">
          <button type="button" className="btn-secondary" onClick={loadMore} disabled={loadingMore}>
            もっと見る
          </button>
        </div>
      )}
    </>
  )
}

export default AdminArtists
