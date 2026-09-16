import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getEvent } from '../api/events.js'
import ArtistThumbnail from '../components/ArtistThumbnail.jsx'
import { listPosts, createPost, deletePost, addReaction, removeReaction } from '../api/posts.js'
import { listMessages, createMessage, deleteMessage } from '../api/messages.js'
import { uploadImages } from '../api/uploads.js'
import { ApiError } from '../lib/api.js'
import { formatDate, formatDateTime, formatTime } from '../lib/formatDate.js'
import ImageLightbox from '../components/ImageLightbox.jsx'

const POST_MAX_LENGTH = 280
const IMAGE_MAX_COUNT = 4
const IMAGE_MAX_SIZE_MB = 5
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const CHAT_MAX_LENGTH = 500
const CHAT_POLL_INTERVAL_MS = 3000
const CHAT_LIST_MAX_HEIGHT_PX = 320
const SCROLL_BOTTOM_THRESHOLD_PX = 40

const TABS = [
  { key: 'official', label: '公式アカウント' },
  { key: 'user', label: 'ユーザー' },
  { key: 'chat', label: 'チャット' },
]

function isNewDay(previous, current) {
  if (!previous) return true
  return new Date(previous.createdAt).toDateString() !== new Date(current.createdAt).toDateString()
}

function PostsSkeleton({ count = 3 }) {
  return (
    <ul className="post-list">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="post" aria-hidden="true">
          <div className="skeleton skeleton-line is-short" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line is-medium" />
        </li>
      ))}
    </ul>
  )
}

function OfficialPostsTab({ eventId }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [zoomedImage, setZoomedImage] = useState(null)

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

  if (loading) return <PostsSkeleton />
  if (error) return <p role="alert">{error}</p>
  if (posts.length === 0) return <p className="empty-state">公式からの投稿はまだありません。</p>

  return (
    <>
      <ul className="post-list">
        {posts.map((post) => (
          <li key={post.id} className="post is-official">
            <span className="badge-official">公式</span>
            <p className="post-body">{post.body}</p>
            {post.imageUrls.length > 0 && (
              <div className="post-images" data-count={Math.min(post.imageUrls.length, 4)}>
                {post.imageUrls.map((url) => (
                  <button
                    key={url}
                    type="button"
                    className="image-zoom-btn"
                    onClick={() => setZoomedImage(url)}
                  >
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            )}
            <div className="post-meta">{formatDateTime(post.createdAt)}</div>
          </li>
        ))}
      </ul>
      {zoomedImage && <ImageLightbox src={zoomedImage} onClose={() => setZoomedImage(null)} />}
    </>
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
  const [files, setFiles] = useState([])
  const [uploadedUrls, setUploadedUrls] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [reactionPending, setReactionPending] = useState(() => new Set())
  const [deletingPostId, setDeletingPostId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [zoomedImage, setZoomedImage] = useState(null)
  const requestRef = useRef(0)
  const fileInputRef = useRef(null)

  const [previews, setPreviews] = useState([])
  useEffect(() => {
    // object URLは明示的に解放しないとメモリに残り続ける
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [files])

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

  function clearFiles() {
    setFiles([])
    setUploadedUrls(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileChange(e) {
    const selected = Array.from(e.target.files)
    setSubmitError(null)
    // 選択し直した場合は、前回アップロード済みのURLを使い回さない
    setUploadedUrls(null)

    if (selected.length > IMAGE_MAX_COUNT) {
      setSubmitError(`画像は${IMAGE_MAX_COUNT}枚までです`)
      clearFiles()
      return
    }
    if (selected.some((file) => !ALLOWED_IMAGE_TYPES.includes(file.type))) {
      setSubmitError('画像はjpeg / png / webpのみ添付できます')
      clearFiles()
      return
    }
    if (selected.some((file) => file.size > IMAGE_MAX_SIZE_MB * 1024 * 1024)) {
      setSubmitError(`画像は1枚あたり${IMAGE_MAX_SIZE_MB}MBまでです`)
      clearFiles()
      return
    }

    setFiles(selected)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      // クールダウン等で投稿だけ失敗した際に再アップロードしないよう、URLを保持して再利用する
      let imageUrls = uploadedUrls
      if (!imageUrls && files.length > 0) {
        imageUrls = (await uploadImages(files)).urls
        setUploadedUrls(imageUrls)
      }
      await createPost(eventId, { body: trimmed, imageUrls: imageUrls ?? undefined })
      setDraft('')
      clearFiles()
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
    setActionError(null)
    applyReaction(post.id, reacted)

    try {
      const state = reacted ? await addReaction(post.id) : await removeReaction(post.id)
      // 他の人のいいねも含めた実数がサーバーから返るので、楽観更新の値を置き換える
      if (requestRef.current === requestId) {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...state } : p)))
      }
    } catch (err) {
      // 一覧が再取得されていた場合、楽観更新の取り消しは新しいデータを壊すので行わない
      if (requestRef.current === requestId) applyReaction(post.id, !reacted)
      setActionError(err instanceof ApiError ? err.message : 'いいねの更新に失敗しました')
    } finally {
      setReactionPending((prev) => {
        const next = new Set(prev)
        next.delete(post.id)
        return next
      })
    }
  }

  async function handleDeletePost(postId) {
    if (deletingPostId) return

    setDeletingPostId(postId)
    setActionError(null)
    try {
      await deletePost(postId)
      // カーソルが配列オフセットのため、件数が減ると続きの取得がずれる。一覧ごと取り直す
      fetchFirstPage()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : '投稿の削除に失敗しました')
    } finally {
      setDeletingPostId(null)
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
      <form className="post-form" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={POST_MAX_LENGTH}
          rows={3}
          placeholder="このイベントについて投稿する"
        />

        <div className="file-picker">
          <input
            id="post-images"
            type="file"
            ref={fileInputRef}
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            multiple
            onChange={handleFileChange}
            disabled={submitting}
          />
          <label className="file-picker-label" htmlFor="post-images">
            画像を選ぶ(最大{IMAGE_MAX_COUNT}枚)
          </label>
        </div>
        {files.length > 0 && (
          <ul className="file-previews">
            {/* previewsはeffectで作られるため、filesが減った直後の描画では追いつかないことがある */}
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                {previews[index] && <img src={previews[index]} alt={file.name} />}
              </li>
            ))}
          </ul>
        )}

        {submitError && <p role="alert">{submitError}</p>}
        <div className="form-row">
          <span className="char-count">
            {draft.length} / {POST_MAX_LENGTH}
          </span>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || draft.trim().length === 0}
          >
            {submitting ? '投稿中...' : '投稿する'}
          </button>
        </div>
      </form>

      <div className="sort-row">
        <button
          type="button"
          className="sort-btn"
          aria-pressed={sort === 'reactions'}
          onClick={() => setSort('reactions')}
        >
          いいね数順
        </button>
        <button
          type="button"
          className="sort-btn"
          aria-pressed={sort === 'latest'}
          onClick={() => setSort('latest')}
        >
          最新順
        </button>
      </div>

      {loading && <PostsSkeleton />}
      {error && <p role="alert">{error}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      {!loading && !error && posts.length === 0 && (
        <p className="empty-state">投稿はまだありません。</p>
      )}

      {posts.length > 0 && (
        <ul className="post-list">
          {posts.map((post) => (
            <li key={post.id} className="post">
              <p className="post-author">{post.authorDisplayName}</p>
              <p className="post-body">{post.body}</p>
              {post.imageUrls.length > 0 && (
                <div className="post-images" data-count={Math.min(post.imageUrls.length, 4)}>
                  {post.imageUrls.map((url) => (
                    <button
                      key={url}
                      type="button"
                      className="image-zoom-btn"
                      onClick={() => setZoomedImage(url)}
                    >
                      <img src={url} alt="" />
                    </button>
                  ))}
                </div>
              )}
              <div className="post-meta">
                <button
                  type="button"
                  className="like-btn"
                  aria-pressed={post.reactedByMe}
                  disabled={reactionPending.has(post.id)}
                  onClick={() => toggleReaction(post)}
                >
                  {post.reactedByMe ? '♥' : '♡'} {post.reactionCount}
                </button>
                <span>{formatDateTime(post.createdAt)}</span>
                {post.isMine && (
                  <button
                    type="button"
                    className="link-btn"
                    disabled={deletingPostId === post.id}
                    onClick={() => handleDeletePost(post.id)}
                  >
                    {deletingPostId === post.id ? '削除中...' : '削除'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {nextCursor && (
        <div className="form-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? '読み込み中...' : 'もっと見る'}
          </button>
        </div>
      )}

      {zoomedImage && <ImageLightbox src={zoomedImage} onClose={() => setZoomedImage(null)} />}
    </div>
  )
}

function ChatTab({ eventId }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [actionError, setActionError] = useState(null)
  const lastMessageRef = useRef(null)
  const polledAtRef = useRef(null)
  const listRef = useRef(null)
  const atBottomRef = useRef(true)

  // 過去ログを読んでいる最中に新着で勝手にスクロールしないよう、最下部付近にいるかを覚えておく
  function handleListScroll() {
    const list = listRef.current
    if (!list) return
    atBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < SCROLL_BOTTOM_THRESHOLD_PX
  }

  function scrollToBottom() {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }

  // 描画前にスクロールしないと、一瞬先頭が見えてから飛ぶ動きになる
  useLayoutEffect(() => {
    if (atBottomRef.current) scrollToBottom()
  }, [messages])

  // ポーリングでは新着しか届かないため、サーバーが返す削除済みidを画面からも取り除く
  function removeMessages(deletedIds) {
    if (!deletedIds || deletedIds.length === 0) return
    const deleted = new Set(deletedIds)
    setMessages((prev) => prev.filter((message) => !deleted.has(message.id)))
  }

  function mergeMessages(incoming) {
    if (incoming.length === 0) return

    setMessages((prev) => {
      const seen = new Set(prev.map((message) => message.id))
      const added = incoming.filter((message) => !seen.has(message.id))
      if (added.length === 0) return prev
      // 送信レスポンスとポーリング結果が前後して届いても時系列を保つ
      return [...prev, ...added].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    })

    // ポーリングの基準は常に最新の発言へ。古い発言で巻き戻さない
    for (const message of incoming) {
      const current = lastMessageRef.current
      if (!current || new Date(message.createdAt) > new Date(current.createdAt)) {
        lastMessageRef.current = { id: message.id, createdAt: message.createdAt }
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    let timerId

    // 直前に取得した発言以降の差分のみを一定間隔で取りに行く
    async function poll() {
      try {
        const body = await listMessages(eventId, {
          after: lastMessageRef.current?.id,
          deletedSince: polledAtRef.current,
        })
        if (cancelled) return
        mergeMessages(body.messages)
        removeMessages(body.deletedIds)
        polledAtRef.current = body.polledAt
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'チャットの取得に失敗しました')
      } finally {
        if (!cancelled) timerId = setTimeout(poll, CHAT_POLL_INTERVAL_MS)
      }
    }

    setLoading(true)
    setMessages([])
    lastMessageRef.current = null
    atBottomRef.current = true
    polledAtRef.current = null
    listMessages(eventId)
      .then((body) => {
        if (cancelled) return
        setMessages(body.messages)
        const newest = body.messages.at(-1)
        lastMessageRef.current = newest ? { id: newest.id, createdAt: newest.createdAt } : null
        polledAtRef.current = body.polledAt
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'チャットの取得に失敗しました')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        timerId = setTimeout(poll, CHAT_POLL_INTERVAL_MS)
      })

    return () => {
      cancelled = true
      clearTimeout(timerId)
    }
  }, [eventId])

  async function handleSend(e) {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return

    setSending(true)
    setActionError(null)
    try {
      const body = await createMessage(eventId, { body: trimmed })
      setDraft('')
      // 自分の発言は、過去ログを見ていた場合でも必ず見えるようにする。
      // ポーリングが先に取得済みで一覧が更新されない場合もあるため、この場でもスクロールする
      atBottomRef.current = true
      mergeMessages([body.message])
      scrollToBottom()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : '送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(messageId) {
    setActionError(null)
    try {
      await deleteMessage(messageId)
      setMessages((prev) => prev.filter((message) => message.id !== messageId))
    } catch (err) {
      // ポーリングが3秒ごとにerrorを消すため、操作エラーは別の状態で保持する
      setActionError(err instanceof ApiError ? err.message : '削除に失敗しました')
    }
  }

  return (
    <div>
      {loading && <PostsSkeleton count={4} />}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && messages.length === 0 && (
        <p className="empty-state">まだ発言はありません。</p>
      )}

      {messages.length > 0 && (
        <ul
          className="chat-list"
          ref={listRef}
          onScroll={handleListScroll}
          style={{ maxHeight: CHAT_LIST_MAX_HEIGHT_PX, overflowY: 'auto' }}
        >
          {messages.map((message, index) => (
            <Fragment key={message.id}>
              {isNewDay(messages[index - 1], message) && (
                <li className="chat-date-separator">{formatDate(message.createdAt)}</li>
              )}
              <li className={message.isMine ? 'chat-row is-mine' : 'chat-row'}>
                <div className="chat-bubble">
                  <div className="chat-head">
                    <span className="chat-author">{message.authorDisplayName}</span>
                    <span>{formatTime(message.createdAt)}</span>
                    {message.isMine && (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => handleDelete(message.id)}
                      >
                        削除
                      </button>
                    )}
                  </div>
                  <p className="chat-body">{message.body}</p>
                </div>
              </li>
            </Fragment>
          ))}
        </ul>
      )}

      {actionError && <p role="alert">{actionError}</p>}
      <form className="chat-form" onSubmit={handleSend}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="メッセージを入力"
          disabled={sending}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={sending || draft.trim().length === 0}
        >
          {sending ? '送信中...' : '送信'}
        </button>
      </form>
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
      <header className="card event-header">
        <h1>{event.title}</h1>
        <p className="event-artist">
          <ArtistThumbnail artist={event.artist} size={56} />
        </p>
        <p>{formatDateTime(event.startsAt)}</p>
        <p>{event.venue}</p>
      </header>

      <nav className="tabs">
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

      <div className="tab-panel">
        {activeTab === 'official' && <OfficialPostsTab eventId={eventId} />}
        {activeTab === 'user' && <UserPostsTab eventId={eventId} />}
        {activeTab === 'chat' && <ChatTab eventId={eventId} />}
      </div>
    </main>
  )
}

export default EventDetail
