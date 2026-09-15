import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signUp(email, password)
      setDone(true)
    } catch (err) {
      setError(err.message ?? '登録に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <main className="card auth-page">
        <h1>登録完了</h1>
        <p>確認メールを送信しました。メール内のリンクを確認後、ログインしてください。</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/login')}>
          ログイン画面へ
        </button>
      </main>
    )
  }

  return (
    <main className="card auth-page">
      <h1>新規登録</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">メールアドレス</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? '登録中...' : '登録する'}
        </button>
      </form>
      <p>
        既にアカウントをお持ちの方は<Link to="/login">ログイン</Link>
      </p>
    </main>
  )
}

export default Signup
