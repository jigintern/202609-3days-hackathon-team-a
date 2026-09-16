import { useCallback } from 'react'
import { getArtists } from '../api/artists.js'
import { useFetch } from '../hooks/useFetch.js'
import ArtistListItem from '../components/ArtistListItem.jsx'
import { useSearchFilter } from '../hooks/useSearchFilter.js'

const getArtistFields = (artist) => [artist.name, artist.nameKana]

function Artists() {
  const fetchArtists = useCallback(() => getArtists().then((body) => body?.artists ?? []), [])
  const { data: artists, setData: setArtists, loading, error } = useFetch(fetchArtists, [])
  const { search, setSearch, filtered: filteredArtists } = useSearchFilter(artists, getArtistFields)

  function handleFollowChange(artistId, isFollowing) {
    setArtists((prev) => prev.map((a) => (a.id === artistId ? { ...a, isFollowing } : a)))
  }

  if (error) return <p role="alert">{error}</p>
  if (loading) return <p>読み込み中...</p>

  return (
    <main>
      <h1>アーティスト一覧</h1>
      <div className="search-bar">
        <label htmlFor="artist-search">アーティストを検索</label>
        <input
          id="artist-search"
          type="search"
          placeholder="アーティスト名・よみがな"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {filteredArtists.length === 0 ? (
        <p className="empty-state">
          {search.trim() ? 'アーティストが見つかりませんでした。' : '登録されているアーティストがいません。'}
        </p>
      ) : (
        <ul className="grid">
          {filteredArtists.map((artist) => (
            <ArtistListItem key={artist.id} artist={artist} onFollowChange={handleFollowChange} />
          ))}
        </ul>
      )}
    </main>
  )
}

export default Artists
