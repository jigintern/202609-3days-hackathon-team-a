import { useCallback } from 'react'
import { getUsers, setUserSuspended } from '../../api/admin.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAsyncAction } from '../../hooks/useAsyncAction.js'
import { useAuth } from '../../hooks/useAuth.jsx'

function AdminUsers() {
  const { profile } = useAuth()
  const fetchUsers = useCallback(() => getUsers().then((body) => body?.users ?? []), [])
  const { data: users, setData: setUsers, loading, error } = useFetch(fetchUsers, [])

  const { run: toggleSuspended, pending, error: actionError } = useAsyncAction(async (user) => {
    const suspend = !user.isSuspended
    const message = suspend
      ? `${user.displayName} を利用停止にします。よろしいですか？`
      : `${user.displayName} の利用停止を解除します。よろしいですか？`
    if (!window.confirm(message)) return

    const body = await setUserSuspended(user.id, suspend)
    setUsers((prev) => prev.map((u) => (u.id === user.id ? body.user : u)))
  })

  if (error) return <p role="alert">{error}</p>
  if (loading) return <p>読み込み中...</p>

  return (
    <>
      <h1 className="admin-title">
        ユーザー一覧
        <span className="admin-badge">管理画面</span>
      </h1>
      {actionError && <p role="alert">{actionError}</p>}

      {users.length === 0 ? (
        <p className="admin-empty">ユーザーがいません。</p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>表示名</th>
                <th>メールアドレス</th>
                <th>権限</th>
                <th>状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName}</td>
                  <td>{user.email}</td>
                  <td>
                    {user.role === 'admin' ? (
                      <span className="admin-status admin-status-primary">運営</span>
                    ) : (
                      <span className="admin-status">一般</span>
                    )}
                  </td>
                  <td>
                    {user.isSuspended ? (
                      <span className="admin-status admin-status-danger">利用停止中</span>
                    ) : (
                      <span className="admin-status">利用中</span>
                    )}
                  </td>
                  <td>
                    {/* 自分を停止すると管理画面から締め出されるため、操作させない */}
                    {user.id === profile?.id ? (
                      <span className="admin-note">自分</span>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => toggleSuspended(user)}
                        disabled={pending}
                      >
                        {user.isSuspended ? '停止を解除' : '利用停止にする'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default AdminUsers
