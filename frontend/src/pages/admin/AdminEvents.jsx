import { useCallback, useState } from 'react'
import {
  createEvent,
  createOfficialPost,
  getAdminArtists,
  getAdminEvents,
  updateEvent,
} from '../../api/admin.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAsyncAction } from '../../hooks/useAsyncAction.js'

const EMPTY = { artistId: '', title: '', venue: '', prefecture: '', startsAt: '' }

function formatDateTime(value) {
  return new Date(value).toLocaleString('ja-JP')
}

// datetime-local は "YYYY-MM-DDTHH:mm" 形式。フォームに戻すためローカル時刻へ変換する
function toInputValue(iso) {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function AdminEvents() {
  const fetchData = useCallback(
    () =>
      Promise.all([getAdminEvents(), getAdminArtists()]).then(([events, artists]) => ({
        events: events?.events ?? [],
        artists: artists?.artists ?? [],
      })),
    [],
  )
  const { data, setData, loading, error } = useFetch(fetchData, [])

  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [officialTarget, setOfficialTarget] = useState(null)
  const [officialBody, setOfficialBody] = useState('')
  const [officialDone, setOfficialDone] = useState(null)

  function startCreate() {
    setEditingId(null)
    setForm(EMPTY)
  }

  function startEdit(event) {
    setEditingId(event.id)
    setForm({
      artistId: event.artist.id,
      title: event.title,
      venue: event.venue,
      prefecture: event.prefecture ?? '',
      startsAt: toInputValue(event.startsAt),
    })
  }

  const { run: submit, pending, error: actionError } = useAsyncAction(async () => {
    const payload = {
      artistId: form.artistId,
      title: form.title.trim(),
      venue: form.venue.trim(),
      startsAt: new Date(form.startsAt).toISOString(),
    }
    // 編集時は空欄も送らないと都道府県を消せない
    if (form.prefecture.trim() || editingId) payload.prefecture = form.prefecture.trim()

    if (editingId) {
      const body = await updateEvent(editingId, payload)
      const artist = data.artists.find((a) => a.id === body.event.artistId)
      setData((prev) => ({
        ...prev,
        events: prev.events.map((e) =>
          e.id === editingId ? { ...e, ...body.event, artist: { id: artist?.id, name: artist?.name } } : e,
        ),
      }))
    } else {
      const body = await createEvent(payload)
      const artist = data.artists.find((a) => a.id === body.event.artistId)
      setData((prev) => ({
        ...prev,
        events: [
          { ...body.event, artist: { id: artist?.id, name: artist?.name }, postCount: 0, messageCount: 0 },
          ...prev.events,
        ],
      }))
    }

    startCreate()
  })

  const { run: submitOfficial, pending: officialPending, error: officialError } = useAsyncAction(
    async () => {
      await createOfficialPost(officialTarget.id, { body: officialBody.trim() })
      setOfficialDone(officialTarget.title)
      setOfficialBody('')
      setOfficialTarget(null)
    },
  )

  if (error) return <p role="alert">{error}</p>
  if (loading) return <p>読み込み中...</p>

  return (
    <>
      <h1>イベント管理</h1>

      <h2>{editingId ? 'イベントを編集' : 'イベントを登録'}</h2>
      {data.artists.length === 0 ? (
        <p>先にアーティストを登録してください。</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label>
            アーティスト
            <select
              value={form.artistId}
              onChange={(e) => setForm({ ...form, artistId: e.target.value })}
              required
            >
              <option value="">選択してください</option>
              {data.artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            公演名
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              maxLength={200}
            />
          </label>
          <label>
            会場
            <input
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              required
              maxLength={200}
            />
          </label>
          <label>
            都道府県
            <input
              value={form.prefecture}
              onChange={(e) => setForm({ ...form, prefecture: e.target.value })}
              maxLength={50}
            />
          </label>
          <label>
            開催日時
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              required
            />
          </label>
          {actionError && <p role="alert">{actionError}</p>}
          <button type="submit" disabled={pending}>
            {editingId ? '更新する' : '登録する'}
          </button>
          {editingId && (
            <button type="button" onClick={startCreate} disabled={pending}>
              編集をやめる
            </button>
          )}
        </form>
      )}

      {officialTarget && (
        <>
          <h2>公式情報を入稿: {officialTarget.title}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitOfficial()
            }}
          >
            <label>
              本文
              <textarea
                value={officialBody}
                onChange={(e) => setOfficialBody(e.target.value)}
                required
                maxLength={280}
              />
            </label>
            {officialError && <p role="alert">{officialError}</p>}
            <button type="submit" disabled={officialPending || !officialBody.trim()}>
              入稿する
            </button>
            <button type="button" onClick={() => setOfficialTarget(null)} disabled={officialPending}>
              やめる
            </button>
          </form>
        </>
      )}

      {officialDone && <p role="status">「{officialDone}」に公式情報を入稿しました。</p>}

      <h2>登録済みのイベント</h2>
      <ul>
        {data.events.map((event) => (
          <li key={event.id}>
            <strong>{event.title}</strong>
            <span>
              {' '}
              / {event.artist?.name} / {event.venue} / {formatDateTime(event.startsAt)}
            </span>
            <span>
              {' '}
              投稿{event.postCount}件 発言{event.messageCount}件
            </span>
            <button type="button" onClick={() => startEdit(event)}>
              編集
            </button>
            <button
              type="button"
              onClick={() => {
                setOfficialTarget(event)
                setOfficialDone(null)
              }}
            >
              公式情報を入稿
            </button>
          </li>
        ))}
      </ul>
      {data.events.length === 0 && <p>まだ登録されていません。</p>}
    </>
  )
}

export default AdminEvents
