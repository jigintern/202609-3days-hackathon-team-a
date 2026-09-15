import { useCallback, useState } from 'react'
import { createArtist, getAdminArtists, updateArtist } from '../../api/admin.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAsyncAction } from '../../hooks/useAsyncAction.js'

const EMPTY = { name: '', nameKana: '', description: '', imageUrl: '' }

// 空文字は送らない（APIは任意項目にURL形式などの検証を掛けているため）
function toPayload(form) {
  const payload = {}
  for (const [key, value] of Object.entries(form)) {
    const trimmed = value.trim()
    if (trimmed) payload[key] = trimmed
  }
  return payload
}

function AdminArtists() {
  const fetchArtists = useCallback(() => getAdminArtists().then((body) => body?.artists ?? []), [])
  const { data: artists, setData: setArtists, loading, error } = useFetch(fetchArtists, [])

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

  const { run: submit, pending, error: actionError } = useAsyncAction(async () => {
    const payload = toPayload(form)

    if (editingId) {
      const body = await updateArtist(editingId, payload)
      setArtists((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...body.artist } : a)))
    } else {
      const body = await createArtist(payload)
      setArtists((prev) => [{ ...body.artist, eventCount: 0, followerCount: 0 }, ...prev])
    }

    startCreate()
  })

  return (
    <>
      <h1>アーティスト管理</h1>

      <h2>{editingId ? 'アーティストを編集' : 'アーティストを登録'}</h2>
      <form
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
        <label>
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
        {actionError && <p role="alert">{actionError}</p>}
        <button type="submit" disabled={pending || !form.name.trim()}>
          {editingId ? '更新する' : '登録する'}
        </button>
        {editingId && (
          <button type="button" onClick={startCreate} disabled={pending}>
            編集をやめる
          </button>
        )}
      </form>

      <h2>登録済みのアーティスト</h2>
      {error && <p role="alert">{error}</p>}
      {loading && <p>読み込み中...</p>}
      {!loading && !error && (
        <ul>
          {artists.map((artist) => (
            <li key={artist.id}>
              <strong>{artist.name}</strong>
              {artist.nameKana && <span>（{artist.nameKana}）</span>}
              <span>
                {' '}
                イベント{artist.eventCount ?? 0}件 ／ フォロワー{artist.followerCount ?? 0}人
              </span>
              <button type="button" onClick={() => startEdit(artist)}>
                編集
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && artists.length === 0 && <p>まだ登録されていません。</p>}
    </>
  )
}

export default AdminArtists
