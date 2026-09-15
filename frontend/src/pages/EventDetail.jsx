import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getEvent } from '../api/events.js'
import { listPosts, createPost, addReaction, removeReaction } from '../api/posts.js'
import { ApiError } from '../lib/api.js'

const POST_MAX_LENGTH = 280

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

function UserPostsTab({ eventId }) {
  const [posts, setPosts] = useState([])
  const [sort, setSort] = useState('reactions')
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [reactionPending, setReactionPending] = useState(() => new Set())
  const [reactionError, setReactionError] = useState(null)
  const requestRef = useRef(0)

  function fetchFirstPage() {
    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)
    listPosts(eventId, { type: 'fan', sort })
      .then((body) => {
        if (requestRef.current !== requestId) return
        setPosts(body.posts)
        setNextCursor(body.nextCursor)
      })
      .catch((err) => {
        if (requestRef.current !== requestId) return
        setError(err instanceof ApiError ? err.message : '投稿の取得に失敗しました')
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false)
      })
  }

  useEffect(() => {
    fetchFirstPage()
    return () => {
      // ソート変更・アンマウント後にこの世代の結果を反映させない
      requestRef.current += 1
    }
  }, [eventId, sort])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      await createPost(eventId, { body: trimmed })
      setDraft('')
      fetchFirstPage()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : '投稿に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  function applyReaction(postId, reacted) {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, reactedByMe: reacted, reactionCount: post.reactionCount + (reacted ? 1 : -1) }
          : post,
      ),
    )
  }

  async function toggleReaction(post) {
    if (reactionPending.has(post.id)) return
    const reacted = !post.reactedByMe
    const requestId = requestRef.current

    setReactionPending((prev) => new Set(prev).add(post.id))
    setReactionError(null)
    applyReaction(post.id, reacted)

    try {
      await (reacted ? addReaction(post.id) : removeReaction(post.id))
    } catch (err) {
      // 一覧が再取得されていた場合、楽観更新の取り消しは新しいデータを壊すので行わない
      if (requestRef.current === requestId) applyReaction(post.id, !reacted)
      setReactionError(err instanceof ApiError ? err.message : 'いいねの更新に失敗しました')
    } finally {
      setReactionPending((prev) => {
        const next = new Set(prev)
        next.delete(post.id)
        return next
      })
    }
  }

  async function loadMore() {
    const requestId = requestRef.current
    setLoadingMore(true)
    try {
      const body = await listPosts(eventId, { type: 'fan', sort, cursor: nextCursor })
      if (requestRef.current !== requestId) return
      // カーソルが配列オフセットのため、並び順が変わると同じ投稿が再度返ることがある
      setPosts((prev) => {
        const seen = new Set(prev.map((post) => post.id))
        return [...prev, ...body.posts.filter((post) => !seen.has(post.id))]
      })
      setNextCursor(body.nextCursor)
    } catch (err) {
      if (requestRef.current !== requestId) return
      setError(err instanceof ApiError ? err.message : '投稿の取得に失敗しました')
    } finally {
      if (requestRef.current === requestId) setLoadingMore(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={POST_MAX_LENGTH}
          rows={3}
          placeholder="投稿する"
        />
        <div>
          {draft.length} / {POST_MAX_LENGTH}
        </div>
        {submitError && <p role="alert">{submitError}</p>}
        <button type="submit" disabled={submitting || draft.trim().length === 0}>
          {submitting ? '投稿中...' : '投稿する'}
        </button>
      </form>

      <div>
        <button type="button" aria-pressed={sort === 'reactions'} onClick={() => setSort('reactions')}>
          いいね数順
        </button>
        <button type="button" aria-pressed={sort === 'latest'} onClick={() => setSort('latest')}>
          最新順
        </button>
      </div>

      {loading && <p>読み込み中...</p>}
      {error && <p role="alert">{error}</p>}
      {reactionError && <p role="alert">{reactionError}</p>}
      {!loading && !error && posts.length === 0 && <p>投稿はまだありません。</p>}

      {posts.length > 0 && (
        <ul>
          {posts.map((post) => (
            <li key={post.id}>
              <p>{post.authorDisplayName}</p>
              <p>{post.body}</p>
              {post.imageUrls.length > 0 && (
                <div>
                  {post.imageUrls.map((url) => (
                    <img key={url} src={url} alt="" style={{ maxWidth: 200 }} />
                  ))}
                </div>
              )}
              <div>
                <button
                  type="button"
                  aria-pressed={post.reactedByMe}
                  disabled={reactionPending.has(post.id)}
                  onClick={() => toggleReaction(post)}
                >
                  {post.reactedByMe ? '♥' : '♡'} {post.reactionCount}
                </button>
                <small>{formatDateTime(post.createdAt)}</small>
              </div>
            </li>
          ))}
        </ul>
      )}

      {nextCursor && (
        <button type="button" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? '読み込み中...' : 'もっと見る'}
        </button>
      )}
    </div>
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
      {activeTab === 'user' && <UserPostsTab eventId={eventId} />}
      {activeTab === 'chat' && <p>準備中</p>}
    </main>
  )
}

export default EventDetail
