import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getVaultProfile, createVaultProfile, destroyVault } from '../api/vault.js'
import { useVault } from '../hooks/useVault.jsx'
import { buildVaultProfile, unlockVault } from '../lib/vaultCrypto.js'
import { ApiError } from '../lib/api.js'

const MIN_MASTER_PASSWORD_LENGTH = 8

function VaultUnlock() {
  const navigate = useNavigate()
  const { unlock } = useVault()
  const [profile, setProfile] = useState(null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [working, setWorking] = useState(false)

  function loadProfile() {
    setLoading(true)
    getVaultProfile()
      .then((body) => {
        setProfile(body.profile)
        setNeedsSetup(false)
        setError(null)
      })
      .catch((err) => {
        setProfile(null)
        // 404は「保管庫が未設定」= 初回セットアップへ誘導する正常系。
        // それ以外の失敗で作成フォームを出すと、既存の保管庫があるのに作り直そうとしてしまう
        const missing = err instanceof ApiError && err.status === 404
        setNeedsSetup(missing)
        setError(missing ? null : err instanceof ApiError ? err.message : '保管庫の確認に失敗しました')
      })
      .finally(() => setLoading(false))
  }

  useEffect(loadProfile, [])

  async function handleSetup(e) {
    e.preventDefault()
    if (password.length < MIN_MASTER_PASSWORD_LENGTH) {
      setError(`マスターパスワードは${MIN_MASTER_PASSWORD_LENGTH}文字以上にしてください`)
      return
    }
    if (password !== passwordConfirm) {
      setError('マスターパスワードが一致しません')
      return
    }

    setWorking(true)
    setError(null)
    try {
      const { payload, key } = await buildVaultProfile(password)
      await createVaultProfile(payload)
      unlock(key)
      navigate('/vault', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保管庫の作成に失敗しました')
      // 既に保管庫がある場合はアンロック画面に切り替える
      if (err instanceof ApiError && err.status === 409) loadProfile()
    } finally {
      setWorking(false)
    }
  }

  async function handleUnlock(e) {
    e.preventDefault()

    setWorking(true)
    setError(null)
    try {
      const key = await unlockVault(password, profile)
      if (!key) {
        setError('マスターパスワードが違います')
        return
      }
      unlock(key)
      navigate('/vault', { replace: true })
    } catch {
      setError('アンロックに失敗しました')
    } finally {
      setWorking(false)
    }
  }

  async function handleDestroy() {
    const confirmed = window.confirm(
      '保管庫を削除すると、保存済みの認証情報はすべて失われ、元に戻せません。削除しますか?',
    )
    if (!confirmed) return

    setWorking(true)
    setError(null)
    try {
      await destroyVault()
      setPassword('')
      setPasswordConfirm('')
      loadProfile()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保管庫の削除に失敗しました')
    } finally {
      setWorking(false)
    }
  }

  if (loading) return <p>読み込み中...</p>

  return (
    <main>
      <p>
        <Link to="/">ホームに戻る</Link>
      </p>
      <h1>パスワード管理</h1>

      {error && <p role="alert">{error}</p>}

      {!profile && !needsSetup && (
        <button type="button" onClick={loadProfile}>
          再読み込み
        </button>
      )}

      {profile ? (
        <form onSubmit={handleUnlock}>
          <p>マスターパスワードを入力してください。</p>
          <div>
            <label htmlFor="master">マスターパスワード</label>
            <input
              id="master"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <button type="submit" disabled={working || !password}>
            {working ? 'アンロック中...' : 'アンロック'}
          </button>
          <p>
            <small>
              マスターパスワードはサーバーに保存されておらず、照合もこの端末の中だけで行います。
              そのため忘れた場合は保管庫を作り直すしかありません。
            </small>
          </p>
          <button type="button" onClick={handleDestroy} disabled={working}>
            マスターパスワードを忘れた(保管庫を削除して作り直す)
          </button>
        </form>
      ) : needsSetup ? (
        <form onSubmit={handleSetup}>
          <p>保管庫がまだありません。マスターパスワードを決めてください。</p>
          <p role="note">
            <strong>
              このマスターパスワードは復旧できません。忘れると保存した認証情報はすべて失われます。
            </strong>
            アプリのログインパスワードとは別のものにしてください。
          </p>
          <div>
            <label htmlFor="master">マスターパスワード</label>
            <input
              id="master"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <div>
            <label htmlFor="masterConfirm">マスターパスワード(確認)</label>
            <input
              id="masterConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <button type="submit" disabled={working || !password || !passwordConfirm}>
            {working ? '作成中...' : '保管庫を作成'}
          </button>
        </form>
      ) : null}

      {working && <p>鍵を計算しています(数秒かかります)...</p>}
    </main>
  )
}

export default VaultUnlock
