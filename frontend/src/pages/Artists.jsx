import { useCallback } from 'react'
import { getArtists } from '../api/artists.js'
import { useFetch } from '../hooks/useFetch.js'
import ArtistListItem from '../components/ArtistListItem.jsx'

function Artists() {
  const fetchArtists = useCallback(() => getArtists().then((body) => body?.artists ?? []), [])
  const { data: artists, setData: setArtists, loading, error } = useFetch(fetchArtists, [])

  function handleFollowChange(artistId, isFollowing) {
    setArtists((prev) =>
      prev.map((a) =>
        a.id === artistId ? { ...a, isFollowing, isOshi: isFollowing && a.isOshi } : a
      )
    )
  }

  function handleOshiChange(artistId, isOshi) {
    setArtists((prev) => prev.map((a) => ({ ...a, isOshi: a.id === artistId ? isOshi : false })))
  }

  if (error) return <p role="alert">{error}</p>
  if (loading) return <p>読み込み中...</p>

  return (
    <main>
      <h1>アーティスト一覧</h1>
      <ul className="grid">
        {artists.map((artist) => (
          <ArtistListItem
            key={artist.id}
            artist={artist}
            onFollowChange={handleFollowChange}
            onOshiChange={handleOshiChange}
          />
        ))}
      </ul>
    </main>
  )
}

export default Artists
