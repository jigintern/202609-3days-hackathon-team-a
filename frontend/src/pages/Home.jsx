import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHome } from '../api/home.js'
import ArtistThumbnail from '../components/ArtistThumbnail.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { ApiError } from '../lib/api.js'
import { formatDateTime } from '../lib/formatDate.js'

function Home() {
  const { profile } = useAuth()
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
      <p>ようこそ、{profile?.displayName ?? 'ゲスト'}さん</p>

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
        <ul className="grid">
          {events.map((event) => (
            <li key={event.id} className="card event-card">
              <Link to={`/events/${event.id}`}>
                <p className="event-card-title">{event.title}</p>
                <p>
                  <ArtistThumbnail artist={event.artist} />
                </p>
                <p>{formatDateTime(event.startsAt)}</p>
                <p>
                  {event.venue}
                  {event.prefecture ? `(${event.prefecture})` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default Home
