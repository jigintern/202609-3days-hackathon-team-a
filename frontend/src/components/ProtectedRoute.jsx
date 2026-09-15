import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

function ProtectedRoute({ children }) {
  const { user, profileRequired, loading } = useAuth()

  if (loading) {
    return <p>読み込み中...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profileRequired) {
    return <Navigate to="/profile-setup" replace />
  }

  return children
}

export default ProtectedRoute
