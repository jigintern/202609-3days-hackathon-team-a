import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getArtist, getArtistEvents } from '../api/artists.js'
import { useFetch } from '../hooks/useFetch.js'
import FollowButton from '../components/FollowButton.jsx'
import OshiButton from '../components/OshiButton.jsx'
import EventListItem from '../components/EventListItem.jsx'

function ArtistDetail() {
  const { artistId } = useParams()
  const [scope, setScope] = useState('upcoming')

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
      <div className="artist-hero">
        {artist.imageUrl && <img src={artist.imageUrl} alt="" />}
        <div className="artist-hero-body">
          <h1>{artist.name}</h1>
          {artist.description && <p>{artist.description}</p>}
          <div className="button-row">
            <FollowButton
              artistId={artist.id}
              isFollowing={artist.isFollowing}
              onChange={(isFollowing) =>
                setArtist((prev) => ({ ...prev, isFollowing, isOshi: isFollowing && prev.isOshi }))
              }
            />
            {artist.isFollowing && (
              <OshiButton
                artistId={artist.id}
                isOshi={artist.isOshi}
                onOshiChange={(artistId, isOshi) => setArtist((prev) => ({ ...prev, isOshi }))}
              />
            )}
          </div>
        </div>
      </div>

      <h2>イベント</h2>
      <div className="button-row">
        <button
          type="button"
          className={scope === 'upcoming' ? 'btn-primary' : 'btn-secondary'}
          aria-pressed={scope === 'upcoming'}
          onClick={() => setScope('upcoming')}
        >
          開催予定
        </button>
        <button
          type="button"
          className={scope === 'past' ? 'btn-primary' : 'btn-secondary'}
          aria-pressed={scope === 'past'}
          onClick={() => setScope('past')}
        >
          過去の公演
        </button>
      </div>
      {eventsError && <p role="alert">{eventsError}</p>}
      {eventsLoading && <p>読み込み中...</p>}
      {!eventsLoading && events && events.length === 0 && (
        <p className="muted">該当するイベントはありません</p>
      )}
      {!eventsLoading && events && events.length > 0 && (
        <ul className="stack">
          {events.map((event) => (
            <EventListItem key={event.id} event={event} />
          ))}
        </ul>
      )}
    </main>
  )
}

export default ArtistDetail
