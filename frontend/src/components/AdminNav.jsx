import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/admin/users', label: 'ユーザー' },
  { to: '/admin/artists', label: 'アーティスト' },
  { to: '/admin/events', label: 'イベント' },
  { to: '/admin/posts', label: 'ポスト' },
  { to: '/admin/event-requests', label: 'イベント追加申請' },
]

const HOME = { to: '/', label: 'アプリに戻る' }

function AdminNav() {
  return (
    <nav aria-label="管理メニュー">
      <ul>
        {LINKS.map((link) => (
          <li key={link.to}>
            <NavLink to={link.to} style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}>
              {link.label}
            </NavLink>
          </li>
        ))}
        <li>
          <NavLink to={HOME.to}>{HOME.label}</NavLink>
        </li>
      </ul>
    </nav>
  )
}

export default AdminNav
