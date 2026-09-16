import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getEvent } from '../api/events.js'
import ArtistThumbnail from '../components/ArtistThumbnail.jsx'
import { listPosts, createPost, deletePost, addReaction, removeReaction } from '../api/posts.js'
import { listMessages, createMessage, deleteMessage } from '../api/messages.js'
import { uploadImages } from '../api/uploads.js'
import { ApiError } from '../lib/api.js'
import { formatDateTime } from '../lib/formatDate.js'

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
  const [files, setFiles] = useState([])
  const [uploadedUrls, setUploadedUrls] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [reactionPending, setReactionPending] = useState(() => new Set())
  const [deletingPostId, setDeletingPostId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const requestRef = useRef(0)
  const fileInputRef = useRef(null)

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

        <input
          type="file"
          ref={fileInputRef}
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          multiple
          onChange={handleFileChange}
          disabled={submitting}
        />
        {files.length > 0 && (
          <ul>
            {files.map((file, index) => (
              <li key={index}>{file.name}</li>
            ))}
          </ul>
        )}

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
      {actionError && <p role="alert">{actionError}</p>}
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
                {post.isMine && (
                  <button
                    type="button"
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
        <button type="button" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? '読み込み中...' : 'もっと見る'}
        </button>
      )}
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
      {loading && <p>読み込み中...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && messages.length === 0 && <p>まだ発言はありません。</p>}

      {messages.length > 0 && (
        <ul
          ref={listRef}
          onScroll={handleListScroll}
          style={{ maxHeight: CHAT_LIST_MAX_HEIGHT_PX, overflowY: 'auto' }}
        >
          {messages.map((message) => (
            <li key={message.id}>
              <p>
                {message.authorDisplayName}
                <small> {formatDateTime(message.createdAt)}</small>
              </p>
              <p>{message.body}</p>
              {message.isMine && (
                <button type="button" onClick={() => handleDelete(message.id)}>
                  削除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSend}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="メッセージを入力"
          disabled={sending}
        />
        {actionError && <p role="alert">{actionError}</p>}
        <button type="submit" disabled={sending || draft.trim().length === 0}>
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
      <header>
        <h1>{event.title}</h1>
        <p>
          <ArtistThumbnail artist={event.artist} size={56} />
        </p>
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
      {activeTab === 'chat' && <ChatTab eventId={eventId} />}
    </main>
  )
}

export default EventDetail
