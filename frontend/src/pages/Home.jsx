import { useAuth } from '../hooks/useAuth.jsx'

function Home() {
  const { profile } = useAuth()

  return (
    <main>
      <p>ようこそ、{profile?.displayName ?? 'ゲスト'}さん</p>
    </main>
  )
}

export default Home
