import { useCallback, useState } from 'react'
import {
  deleteAdminMessage,
  deleteAdminPost,
  getAdminMessages,
  getAdminPosts,
} from '../../api/admin.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAsyncAction } from '../../hooks/useAsyncAction.js'

function formatDateTime(value) {
  return new Date(value).toLocaleString('ja-JP')
}

function AdminPosts() {
  const [tab, setTab] = useState('posts')

  const fetchData = useCallback(
    () =>
      Promise.all([getAdminPosts(), getAdminMessages()]).then(([posts, messages]) => ({
        posts: posts?.posts ?? [],
        messages: messages?.messages ?? [],
      })),
    [],
  )
  const { data, setData, loading, error } = useFetch(fetchData, [])

  const { run: removePost, pending: postPending, error: postError } = useAsyncAction(async (post) => {
    if (!window.confirm(`この投稿を削除します。よろしいですか？\n\n${post.body}`)) return

    await deleteAdminPost(post.id)
    setData((prev) => ({ ...prev, posts: prev.posts.filter((p) => p.id !== post.id) }))
  })

  const { run: removeMessage, pending: messagePending, error: messageError } = useAsyncAction(
    async (message) => {
      if (!window.confirm(`この発言を削除します。よろしいですか？\n\n${message.body}`)) return

      await deleteAdminMessage(message.id)
      setData((prev) => ({ ...prev, messages: prev.messages.filter((m) => m.id !== message.id) }))
    },
  )

  if (error) return <p role="alert">{error}</p>
  if (loading) return <p>読み込み中...</p>

  return (
    <>
      <h1 className="admin-title">
        ポスト管理
        <span className="admin-badge">管理画面</span>
      </h1>

      <div className="admin-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'posts'} onClick={() => setTab('posts')}>
          投稿（{data.posts.length}）
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'messages'}
          onClick={() => setTab('messages')}
        >
          チャット（{data.messages.length}）
        </button>
      </div>

      {tab === 'posts' && (
        <>
          {postError && <p role="alert">{postError}</p>}
          <ul className="admin-list">
            {data.posts.map((post) => (
              <li key={post.id} className="card admin-list-item">
                <div className="admin-list-main">
                  <p className="admin-list-body">
                    {post.type === 'official' && (
                      <span className="admin-status admin-status-primary">公式</span>
                    )}{' '}
                    {post.body}
                  </p>
                  <p className="admin-meta">
                    {post.author?.displayName} ／ {post.event?.title} ／{' '}
                    {formatDateTime(post.createdAt)}
                  </p>
                </div>
                <div className="admin-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => removePost(post)}
                    disabled={postPending}
                  >
                    削除する
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {data.posts.length === 0 && <p className="admin-empty">投稿はありません。</p>}
        </>
      )}

      {tab === 'messages' && (
        <>
          {messageError && <p role="alert">{messageError}</p>}
          <ul className="admin-list">
            {data.messages.map((message) => (
              <li key={message.id} className="card admin-list-item">
                <div className="admin-list-main">
                  <p className="admin-list-body">{message.body}</p>
                  <p className="admin-meta">
                    {message.author?.displayName} ／ {message.event?.title} ／{' '}
                    {formatDateTime(message.createdAt)}
                  </p>
                </div>
                <div className="admin-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => removeMessage(message)}
                    disabled={messagePending}
                  >
                    削除する
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {data.messages.length === 0 && <p className="admin-empty">発言はありません。</p>}
        </>
      )}
    </>
  )
}

export default AdminPosts
