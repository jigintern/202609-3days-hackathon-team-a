import { useCallback, useState } from 'react'
import { getEventRequests, updateEventRequestStatus } from '../../api/admin.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAsyncAction } from '../../hooks/useAsyncAction.js'
import { formatDateTime } from '../../lib/formatDate.js'

const STATUS_LABEL = { pending: '未対応', approved: '承認済み', rejected: '却下' }

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
      <h1 className="admin-title">
        イベント追加申請
        <span className="admin-badge">管理画面</span>
      </h1>

      <label className="admin-filter">
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
        <ul className="admin-list">
          {requests.map((request) => (
            <li key={request.id} className="card admin-list-item">
              <div className="admin-list-main">
                <p className="admin-list-body">
                  <strong>{request.artistName}</strong> ／ {request.title}
                </p>
                <p className="admin-meta">
                  会場: {request.venue || '未定'} ／ 開催日: {request.startsAt ? formatDateTime(request.startsAt) : '未定'}
                </p>
                {request.note && <p className="admin-meta">備考: {request.note}</p>}
                <p className="admin-meta">
                  申請者: {request.user?.displayName ?? '不明'}{' '}
                  <span
                    className={`admin-status${request.status === 'pending' ? ' admin-status-primary' : ''}`}
                  >
                    {STATUS_LABEL[request.status]}
                  </span>
                </p>
              </div>
              {request.status === 'pending' && (
                <div className="admin-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => decide(request, 'approved')}
                    disabled={pending}
                  >
                    承認する
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => decide(request, 'rejected')}
                    disabled={pending}
                  >
                    却下する
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && requests.length === 0 && (
        <p className="admin-empty">該当する申請はありません。</p>
      )}
      <p className="admin-note">
        承認するとイベントが自動で登録されます(一覧に無いアーティストは同時に作成されます)。
        開催日時か会場が未入力の申請だけは自動作成できないため、イベント管理から登録してください。
      </p>
    </>
  )
}

export default AdminEventRequests
