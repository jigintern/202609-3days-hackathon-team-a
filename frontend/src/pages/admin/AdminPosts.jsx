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
    await deleteAdminPost(post.id)
    setData((prev) => ({ ...prev, posts: prev.posts.filter((p) => p.id !== post.id) }))
  })

  const { run: removeMessage, pending: messagePending, error: messageError } = useAsyncAction(
    async (message) => {
      await deleteAdminMessage(message.id)
      setData((prev) => ({ ...prev, messages: prev.messages.filter((m) => m.id !== message.id) }))
    },
  )

  if (error) return <p role="alert">{error}</p>
  if (loading) return <p>読み込み中...</p>

  return (
    <>
      <h1>ポスト管理</h1>

      <div role="tablist">
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
          <ul>
            {data.posts.map((post) => (
              <li key={post.id}>
                <p>
                  {post.type === 'official' ? '【公式】' : ''}
                  {post.body}
                </p>
                <p>
                  {post.author?.displayName} ／ {post.event?.title} ／ {formatDateTime(post.createdAt)}
                </p>
                <button type="button" onClick={() => removePost(post)} disabled={postPending}>
                  削除する
                </button>
              </li>
            ))}
          </ul>
          {data.posts.length === 0 && <p>投稿はありません。</p>}
        </>
      )}

      {tab === 'messages' && (
        <>
          {messageError && <p role="alert">{messageError}</p>}
          <ul>
            {data.messages.map((message) => (
              <li key={message.id}>
                <p>{message.body}</p>
                <p>
                  {message.author?.displayName} ／ {message.event?.title} ／{' '}
                  {formatDateTime(message.createdAt)}
                </p>
                <button type="button" onClick={() => removeMessage(message)} disabled={messagePending}>
                  削除する
                </button>
              </li>
            ))}
          </ul>
          {data.messages.length === 0 && <p>発言はありません。</p>}
        </>
      )}
    </>
  )
}

export default AdminPosts
