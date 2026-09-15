import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/admin/users', label: 'ユーザー' },
  { to: '/admin/artists', label: 'アーティスト' },
  { to: '/admin/events', label: 'イベント' },
  { to: '/admin/posts', label: 'ポスト' },
  { to: '/admin/event-requests', label: 'イベント追加申請' },
]

function AdminNav() {
  return (
    <nav aria-label="管理メニュー">
      <ul className="admin-nav">
        {LINKS.map((link) => (
          <li key={link.to}>
            <NavLink to={link.to}>{link.label}</NavLink>
          </li>
        ))}
        <li className="admin-nav-spacer">
          <NavLink to="/">アプリに戻る</NavLink>
        </li>
      </ul>
    </nav>
  )
}

export default AdminNav
