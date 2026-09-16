import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHome } from '../api/home.js'
import ArtistThumbnail from '../components/ArtistThumbnail.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { ApiError } from '../lib/api.js'
import { formatDateTime } from '../lib/formatDate.js'
import { useSearchFilter } from '../hooks/useSearchFilter.js'

const getEventFields = (event) => [event.title, event.artist?.name, event.venue, event.prefecture]
const TABS = [
  { key: 'all', label: 'すべて', emptyMessage: '条件に一致するイベントがありません。' },
  {
    key: 'following',
    label: 'フォロー中',
    emptyMessage: (
      <>
        フォロー中のアーティストのイベントはありません。
        <Link to="/artists">アーティストをフォロー</Link>すると、
        そのアーティストの開催予定イベントがここに表示されます。
      </>
    ),
  },
  { key: 'not-following', label: 'フォロー以外', emptyMessage: 'フォロー以外のイベントはありません。' },
]

function Home() {
  const { profile } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const tabEvents = useMemo(
    () => activeTab === 'all'
      ? events
      : events.filter((event) => event.artist.isFollowing === (activeTab === 'following')),
    [events, activeTab],
  )
  const { search, setSearch, filtered: filteredEvents } = useSearchFilter(tabEvents, getEventFields)

  useEffect(() => {
    let active = true
    getHome()
      .then((body) => {
        if (active) setEvents(body.events ?? [])
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

      <h2>開催予定のイベント</h2>

      <nav className="tabs" aria-label="イベントの絞り込み">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="tab"
            aria-pressed={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {loading && <p>読み込み中...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && events.length === 0 && (
        <p>現在開催予定のイベントはありません。</p>
      )}

      {events.length > 0 && (
        <div className="search-bar">
          <label htmlFor="event-search">イベントを検索</label>
          <input
            id="event-search"
            type="search"
            placeholder="イベント名・アーティスト名・会場・都道府県"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {events.length > 0 && tabEvents.length === 0 && (
        <p className="empty-state">{TABS.find((tab) => tab.key === activeTab).emptyMessage}</p>
      )}

      {tabEvents.length > 0 && filteredEvents.length === 0 && (
        <p className="empty-state">条件に一致するイベントが見つかりませんでした。</p>
      )}

      {filteredEvents.length > 0 && (
        <ul className="grid">
          {filteredEvents.map((event) => (
            <li key={event.id} className={`card event-card${event.artist.isOshi ? ' is-oshi' : ''}`}>
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
