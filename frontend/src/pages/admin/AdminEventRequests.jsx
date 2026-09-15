import { useCallback, useState } from 'react'
import { getEventRequests, updateEventRequestStatus } from '../../api/admin.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAsyncAction } from '../../hooks/useAsyncAction.js'

const STATUS_LABEL = { pending: '未対応', approved: '承認済み', rejected: '却下' }

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('ja-JP') : '未定'
}

function AdminEventRequests() {
  const [status, setStatus] = useState('pending')

  const fetchRequests = useCallback(
    () => getEventRequests(status).then((body) => body?.eventRequests ?? []),
    [status],
  )
  const { data: requests, setData: setRequests, loading, error } = useFetch(fetchRequests, [status])

  const { run: decide, pending, error: actionError } = useAsyncAction(async (request, nextStatus) => {
    await updateEventRequestStatus(request.id, nextStatus)
    // 絞り込み中は対象外になるので一覧から取り除く
    setRequests((prev) =>
      status ? prev.filter((r) => r.id !== request.id) : prev.map((r) => (r.id === request.id ? { ...r, status: nextStatus } : r)),
    )
  })

  return (
    <>
      <h1>イベント追加申請</h1>

      <label>
        状態で絞り込む
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">未対応</option>
          <option value="approved">承認済み</option>
          <option value="rejected">却下</option>
          <option value="">すべて</option>
        </select>
      </label>

      {actionError && <p role="alert">{actionError}</p>}
      {error && <p role="alert">{error}</p>}
      {loading && <p>読み込み中...</p>}

      {!loading && !error && (
        <ul>
          {requests.map((request) => (
            <li key={request.id}>
              <p>
                <strong>{request.artistName}</strong> / {request.title}
              </p>
              <p>
                会場: {request.venue || '未定'} ／ 開催日: {formatDateTime(request.startsAt)}
              </p>
              {request.note && <p>備考: {request.note}</p>}
              <p>
                申請者: {request.user?.displayName ?? '不明'} ／ 状態: {STATUS_LABEL[request.status]}
              </p>
              {request.status === 'pending' && (
                <>
                  <button type="button" onClick={() => decide(request, 'approved')} disabled={pending}>
                    承認する
                  </button>
                  <button type="button" onClick={() => decide(request, 'rejected')} disabled={pending}>
                    却下する
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && requests.length === 0 && <p>該当する申請はありません。</p>}
      <p>承認した申請は、イベント管理から実際のイベントとして登録してください。</p>
    </>
  )
}

export default AdminEventRequests
