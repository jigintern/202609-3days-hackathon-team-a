import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

/**
 * ヘッダーに出す管理画面への導線。
 * Header.jsx は共通コンポーネントなので、判定もリンクもこちら側に閉じ込めて、
 * 向こうへの変更を1行の追加だけに留めている。
 */
function AdminEntryLink() {
  const { profile } = useAuth()

  if (profile?.role !== 'admin') return null

  return <Link to="/admin/users">管理画面</Link>
}

export default AdminEntryLink
