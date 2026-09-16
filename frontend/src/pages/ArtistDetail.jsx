import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getArtist, getArtistEvents } from '../api/artists.js'
import { useFetch } from '../hooks/useFetch.js'
import FollowButton from '../components/FollowButton.jsx'
import EventListItem from '../components/EventListItem.jsx'

function ArtistDetail() {
  const { artistId } = useParams()
  const [scope, setScope] = useState('upcoming')
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [artistId])

  const fetchArtist = useCallback(() => getArtist(artistId).then((body) => body.artist), [artistId])
  const {
    data: artist,
    setData: setArtist,
    loading: artistLoading,
    error: artistError,
  } = useFetch(fetchArtist, [artistId])

  const fetchEvents = useCallback(
    () => getArtistEvents(artistId, scope).then((body) => body?.events ?? []),
    [artistId, scope]
  )
  const { data: events, loading: eventsLoading, error: eventsError } = useFetch(fetchEvents, [artistId, scope])

  if (artistError) return <p role="alert">{artistError}</p>
  if (artistLoading || !artist) return <p>読み込み中...</p>

  return (
    <main>
      {artist.imageUrl && !imageFailed && (
        <img
          src={artist.imageUrl}
          alt={artist.name}
          width={120}
          onError={() => setImageFailed(true)}
        />
      )}
      <h1>{artist.name}</h1>
      {artist.description && <p>{artist.description}</p>}
      <FollowButton
        artistId={artist.id}
        isFollowing={artist.isFollowing}
        onChange={(isFollowing) => setArtist((prev) => ({ ...prev, isFollowing }))}
      />

      <h2>イベント</h2>
      <div>
        <button type="button" onClick={() => setScope('upcoming')} disabled={scope === 'upcoming'}>
          開催予定
        </button>
        <button type="button" onClick={() => setScope('past')} disabled={scope === 'past'}>
          過去の公演
        </button>
      </div>
      {eventsError && <p role="alert">{eventsError}</p>}
      {eventsLoading && <p>読み込み中...</p>}
      {!eventsLoading && events && events.length === 0 && <p>該当するイベントはありません</p>}
      {!eventsLoading && events && events.length > 0 && (
        <ul>
          {events.map((event) => (
            <EventListItem key={event.id} event={event} />
          ))}
        </ul>
      )}
    </main>
  )
}

export default ArtistDetail
