import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getEvent } from '../api/events.js'
import { listPosts } from '../api/posts.js'
import { ApiError } from '../lib/api.js'

const TABS = [
  { key: 'official', label: '公式アカウント' },
  { key: 'user', label: 'ユーザー' },
  { key: 'chat', label: 'チャット' },
]

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function OfficialPostsTab({ eventId }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    listPosts(eventId, { type: 'official' })
      .then((body) => {
        if (!active) return
        setPosts(body.posts)
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof ApiError ? err.message : '投稿の取得に失敗しました')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [eventId])

  if (loading) return <p>読み込み中...</p>
  if (error) return <p role="alert">{error}</p>
  if (posts.length === 0) return <p>公式からの投稿はまだありません。</p>

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <p>{post.body}</p>
          {post.imageUrls.length > 0 && (
            <div>
              {post.imageUrls.map((url) => (
                <img key={url} src={url} alt="" style={{ maxWidth: 200 }} />
              ))}
            </div>
          )}
          <small>{formatDateTime(post.createdAt)}</small>
        </li>
      ))}
    </ul>
  )
}

function EventDetail() {
  const { eventId } = useParams()
  const [event, setEvent] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('official')

  useEffect(() => {
    let active = true
    setEvent(null)
    setError(null)
    getEvent(eventId)
      .then((body) => {
        if (active) setEvent(body.event)
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'イベントの取得に失敗しました')
      })
    return () => {
      active = false
    }
  }, [eventId])

  if (error) return <p role="alert">{error}</p>
  if (!event) return <p>読み込み中...</p>

  return (
    <main>
      <header>
        <h1>{event.title}</h1>
        <p>{event.artist.name}</p>
        <p>{formatDateTime(event.startsAt)}</p>
        <p>{event.venue}</p>
      </header>

      <nav>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'official' && <OfficialPostsTab eventId={eventId} />}
      {activeTab === 'user' && <p>準備中</p>}
      {activeTab === 'chat' && <p>準備中</p>}
    </main>
  )
}

export default EventDetail
