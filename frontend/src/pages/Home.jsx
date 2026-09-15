import { useAuth } from '../hooks/useAuth.jsx'

function Home() {
  const { profile, signOut } = useAuth()

  return (
    <main>
      <h1>推し活アプリ</h1>
      <p>ようこそ、{profile?.displayName ?? 'ゲスト'}さん</p>
      <button type="button" onClick={signOut}>
        ログアウト
      </button>
    </main>
  )
}

export default Home
