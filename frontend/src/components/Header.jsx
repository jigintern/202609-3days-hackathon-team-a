import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

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
          <button type="button" className="btn-secondary" onClick={signOut}>
            ログアウト
          </button>
        </nav>
      </div>
    </header>
  )
}

export default Header
