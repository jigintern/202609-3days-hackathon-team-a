import { useCallback } from 'react'
import { getUsers, setUserSuspended } from '../../api/admin.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAsyncAction } from '../../hooks/useAsyncAction.js'

function AdminUsers() {
  const fetchUsers = useCallback(() => getUsers().then((body) => body?.users ?? []), [])
  const { data: users, setData: setUsers, loading, error } = useFetch(fetchUsers, [])

  const { run: toggleSuspended, pending, error: actionError } = useAsyncAction(async (user) => {
    const body = await setUserSuspended(user.id, !user.isSuspended)
    setUsers((prev) => prev.map((u) => (u.id === user.id ? body.user : u)))
  })

  if (error) return <p role="alert">{error}</p>
  if (loading) return <p>読み込み中...</p>

  return (
    <>
      <h1>ユーザー一覧</h1>
      {actionError && <p role="alert">{actionError}</p>}
      <table>
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
              <td>{user.role === 'admin' ? '運営' : '一般'}</td>
              <td>{user.isSuspended ? '利用停止中' : '利用中'}</td>
              <td>
                <button type="button" onClick={() => toggleSuspended(user)} disabled={pending}>
                  {user.isSuspended ? '停止を解除' : '利用停止にする'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <p>ユーザーがいません。</p>}
    </>
  )
}

export default AdminUsers
