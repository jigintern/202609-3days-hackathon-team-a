import { followArtist, unfollowArtist } from '../api/artists.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'

function FollowButton({ artistId, isFollowing, onChange }) {
  const { run, pending, error } = useAsyncAction(async () => {
    const action = isFollowing ? unfollowArtist : followArtist
    await action(artistId)
    onChange(!isFollowing)
  })

  return (
    <>
      <button
        type="button"
        className={isFollowing ? 'btn-secondary' : 'btn-primary'}
        onClick={run}
        disabled={pending}
      >
        {isFollowing ? 'フォロー中' : 'フォローする'}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}

export default FollowButton
