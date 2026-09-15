import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHome } from '../api/home.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { ApiError } from '../lib/api.js'
import { formatDateTime } from '../lib/formatDate.js'

function Home() {
  const { profile, signOut } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    getHome()
      .then((body) => {
        if (active) setEvents(body.events)
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'イベントの取得に失敗しました')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <main>
      <header>
        <h1>推し活アプリ</h1>
        <p>ようこそ、{profile?.displayName ?? 'ゲスト'}さん</p>
        <button type="button" onClick={signOut}>
          ログアウト
        </button>
        <nav>
          <Link to="/artists">アーティスト一覧</Link>
          <Link to="/event-requests/new">イベント追加申請</Link>
          {profile?.role === 'admin' && <Link to="/admin/users">管理画面</Link>}
        </nav>
      </header>

      <h2>フォロー中のイベント</h2>

      {loading && <p>読み込み中...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && events.length === 0 && (
        <p>
          開催予定のイベントがありません。<Link to="/artists">アーティストをフォロー</Link>すると、
          そのアーティストのイベントがここに表示されます。
        </p>
      )}

      {events.length > 0 && (
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <Link to={`/events/${event.id}`}>{event.title}</Link>
              <p>{event.artist.name}</p>
              <p>{formatDateTime(event.startsAt)}</p>
              <p>
                {event.venue}
                {event.prefecture ? `(${event.prefecture})` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default Home
