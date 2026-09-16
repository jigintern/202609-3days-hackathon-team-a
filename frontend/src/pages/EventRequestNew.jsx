import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createEventRequest, listMyEventRequests } from '../api/eventRequests.js'
import { useFetch } from '../hooks/useFetch.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { formatDateTime } from '../lib/formatDate.js'

const STATUS_LABELS = {
  pending: '審査中',
  approved: '承認済み',
  rejected: '却下',
}

const EMPTY_FORM = { artistName: '', title: '', venue: '', startsAt: '', note: '' }

function EventRequestNew() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const { data, loading, error } = useFetch(listMyEventRequests, [reloadKey])
  const requests = data?.eventRequests ?? []

  const {
    run: submit,
    pending: submitting,
    error: submitError,
  } = useAsyncAction(async () => {
    await createEventRequest({
      artistName: form.artistName.trim(),
      title: form.title.trim(),
      venue: form.venue.trim() || undefined,
      // datetime-localはタイムゾーンを持たないため、ISO形式に直してから送る
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      note: form.note.trim() || undefined,
    })
    setForm(EMPTY_FORM)
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

  const canSubmit = form.artistName.trim() && form.title.trim() && !submitting

  return (
    <main>
      <p>
        <Link to="/">ホームに戻る</Link>
      </p>
      <h1>イベント追加申請</h1>
      <p>登録されていないイベントを運営に申請できます。内容を確認のうえ運営が登録します。</p>

      <form onSubmit={handleSubmit}>
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
        <button type="submit" disabled={!canSubmit}>
          {submitting ? '申請中...' : '申請する'}
        </button>
      </form>

      <h2>申請した内容</h2>
      {loading && <p>読み込み中...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && requests.length === 0 && <p>まだ申請はありません。</p>}

      {requests.length > 0 && (
        <ul>
          {requests.map((request) => (
            <li key={request.id}>
              <p>
                {request.artistName} / {request.title}
              </p>
              <p>{STATUS_LABELS[request.status] ?? request.status}</p>
              {request.startsAt && <p>{formatDateTime(request.startsAt)}</p>}
              {request.venue && <p>{request.venue}</p>}
              {request.note && <p>{request.note}</p>}
              <small>申請日: {formatDateTime(request.createdAt)}</small>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default EventRequestNew
