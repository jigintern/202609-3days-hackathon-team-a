import { useState } from 'react'
import { createEventRequest, listMyEventRequests } from '../api/eventRequests.js'
import { getArtists } from '../api/artists.js'
import { useFetch } from '../hooks/useFetch.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { formatDateTime } from '../lib/formatDate.js'

const STATUS_LABELS = {
  pending: '審査中',
  approved: '承認済み',
  rejected: '却下',
}

// プルダウンで「その他」を選んだときだけ自由入力を使う
const OTHER = 'other'

const EMPTY_FORM = {
  artistId: '',
  artistName: '',
  title: '',
  venue: '',
  startsAt: '',
  note: '',
}

function EventRequestNew() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [artistQuery, setArtistQuery] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const { data, loading, error } = useFetch(listMyEventRequests, [reloadKey])
  const requests = data?.eventRequests ?? []

  const { data: artistData, error: artistError } = useFetch(getArtists, [])
  const artists = artistData?.artists ?? []

  // 同名のアーティストが登録され得るため、選択値には名前ではなくIDを使う
  const selectedArtist = artists.find((artist) => artist.id === form.artistId)
  const selectedArtistName =
    form.artistId === OTHER ? form.artistName.trim() : (selectedArtist?.name ?? '')

  const query = artistQuery.trim().toLowerCase()
  const matched = query
    ? artists.filter(
        (artist) =>
          artist.name.toLowerCase().includes(query) ||
          (artist.nameKana ?? '').toLowerCase().includes(query),
      )
    : artists
  // 絞り込みで選択中の候補が消えると、選んだはずの値が画面から消えてしまう
  const visibleArtists =
    selectedArtist && !matched.some((artist) => artist.id === selectedArtist.id)
      ? [selectedArtist, ...matched]
      : matched

  const {
    run: submit,
    pending: submitting,
    error: submitError,
  } = useAsyncAction(async () => {
    await createEventRequest({
      // 一覧から選んだ場合はIDも送り、どのアーティストかDBに残す
      artistId: form.artistId === OTHER ? undefined : form.artistId,
      artistName: selectedArtistName,
      title: form.title.trim(),
      venue: form.venue.trim() || undefined,
      // datetime-localはタイムゾーンを持たないため、ISO形式に直してから送る
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      note: form.note.trim() || undefined,
    })
    setForm(EMPTY_FORM)
    setArtistQuery('')
    setSubmitted(true)
    setReloadKey((prev) => prev + 1)
  })

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
    setSubmitted(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    submit()
  }

  const canSubmit = selectedArtistName && form.title.trim() && !submitting

  return (
    <main>
      <h1>イベント追加申請</h1>
      <p className="muted">
        登録されていないイベントを運営に申請できます。内容を確認のうえ運営が登録します。
      </p>

      <section className="card form-card">
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="artistSearch">アーティスト(必須)</label>
            {/* 絞り込み中にEnterを押すと申請が飛んでしまうため、ここでは送信させない */}
            <input
              id="artistSearch"
              type="search"
              value={artistQuery}
              onChange={(e) => setArtistQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault()
              }}
              placeholder="名前で絞り込む"
            />
            <select
              id="artistId"
              value={form.artistId}
              onChange={(e) => updateField('artistId', e.target.value)}
              required
            >
              <option value="">選択してください</option>
              {visibleArtists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
              <option value={OTHER}>その他(一覧にない)</option>
            </select>
            {query && matched.length === 0 && (
              <p className="muted">
                「{artistQuery}」に一致するアーティストはいません。「その他」で入力してください。
              </p>
            )}
            {artistError && (
              <p role="alert">
                アーティストの一覧を取得できませんでした。「その他」で名前を入力してください。
              </p>
            )}
          </div>
          {form.artistId === OTHER && (
            <div>
              <label htmlFor="artistName">アーティスト名(必須)</label>
              <input
                id="artistName"
                value={form.artistName}
                onChange={(e) => updateField('artistName', e.target.value)}
                maxLength={100}
                required
              />
            </div>
          )}
          <div>
            <label htmlFor="title">イベント名(必須)</label>
            <input
              id="title"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              maxLength={100}
              required
            />
          </div>
          <div>
            <label htmlFor="startsAt">開催日時</label>
            <input
              id="startsAt"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => updateField('startsAt', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="venue">会場</label>
            <input
              id="venue"
              value={form.venue}
              onChange={(e) => updateField('venue', e.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="note">備考</label>
            <textarea
              id="note"
              value={form.note}
              onChange={(e) => updateField('note', e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          {submitError && <p role="alert">{submitError}</p>}
          {submitted && <p>申請しました。運営の確認をお待ちください。</p>}
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {submitting ? '申請中...' : '申請する'}
          </button>
        </form>
      </section>

      <h2>申請した内容</h2>
      {loading && <p>読み込み中...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && requests.length === 0 && <p className="muted">まだ申請はありません。</p>}

      {requests.length > 0 && (
        <ul className="stack">
          {requests.map((request) => (
            <li key={request.id} className="card request-card">
              <div className="request-head">
                <p className="request-title">
                  {request.artistName} / {request.title}
                </p>
                <span className={`badge badge-${request.status}`}>
                  {STATUS_LABELS[request.status] ?? request.status}
                </span>
              </div>
              {request.startsAt && <p>{formatDateTime(request.startsAt)}</p>}
              {request.venue && <p>{request.venue}</p>}
              {request.note && <p>{request.note}</p>}
              <p>申請日: {formatDateTime(request.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default EventRequestNew
