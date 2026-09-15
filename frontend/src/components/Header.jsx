import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import AdminEntryLink from './AdminEntryLink.jsx'

function Header() {
  const { signOut } = useAuth()

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="header-logo">
          推し活アプリ
        </Link>
        <nav className="header-nav">
          <Link to="/">ホーム</Link>
          <Link to="/artists">アーティスト</Link>
          <Link to="/event-requests/new">イベント追加申請</Link>
          <Link to="/vault/unlock">パスワード管理</Link>
          <AdminEntryLink />
          <button type="button" className="btn-secondary" onClick={signOut}>
            ログアウト
          </button>
        </nav>
      </div>
    </header>
  )
}

export default Header
