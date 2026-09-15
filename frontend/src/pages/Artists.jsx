import { useEffect, useState } from 'react'
import { getArtists } from '../api/artists.js'
import FollowButton from '../components/FollowButton.jsx'

function Artists() {
  const [artists, setArtists] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getArtists()
      .then((body) => setArtists(body.artists))
      .catch((err) => setError(err.message ?? '取得に失敗しました'))
  }, [])

  if (error) return <p role="alert">{error}</p>
  if (!artists) return <p>読み込み中...</p>

  return (
    <main>
      <h1>アーティスト一覧</h1>
      <ul className="grid">
        {artists.map((artist) => (
          <li key={artist.id} className="card grid-item">
            <span>{artist.name}</span>
            <FollowButton
              artistId={artist.id}
              isFollowing={artist.isFollowing}
              onChange={(isFollowing) =>
                setArtists((prev) =>
                  prev.map((a) => (a.id === artist.id ? { ...a, isFollowing } : a))
                )
              }
            />
          </li>
        ))}
      </ul>
    </main>
  )
}

export default Artists
