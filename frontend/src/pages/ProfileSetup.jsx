import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

function ProfileSetup() {
  const { createProfile } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createProfile(displayName)
      navigate('/')
    } catch (err) {
      setError(err.message ?? 'プロフィールの作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main>
      <h1>プロフィール登録</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="displayName">表示名</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            required
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? '登録中...' : '登録して始める'}
        </button>
      </form>
    </main>
  )
}

export default ProfileSetup
