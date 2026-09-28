import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import Layout from './Layout.jsx'
import AdminNav from './AdminNav.jsx'
import '../styles/admin.css'

function AdminRoute({ children }) {
  const { user, profile, profileRequired, loading } = useAuth()

  if (loading) {
    return <p>読み込み中...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profileRequired) {
    return <Navigate to="/profile-setup" replace />
  }

  // サーバー側でも requireAdmin で弾いているので、ここは画面を出さないための措置
  if (profile?.role !== 'admin') {
    return (
      <Layout>
        <h1 className="admin-title">管理画面</h1>
        <p role="alert">この画面は運営のみが利用できます。</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <AdminNav />
      {children}
    </Layout>
  )
}

export default AdminRoute
