import { useState } from 'react'
import { followArtist, unfollowArtist } from '../api/artists.js'

function FollowButton({ artistId, isFollowing, onChange }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)

  async function handleClick() {
    setError(null)
    setPending(true)
    try {
      if (isFollowing) {
        await unfollowArtist(artistId)
        onChange(false)
      } else {
        await followArtist(artistId)
        onChange(true)
      }
    } catch (err) {
      setError(err.message ?? '操作に失敗しました')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button type="button" onClick={handleClick} disabled={pending}>
        {isFollowing ? 'フォロー中' : 'フォローする'}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}

export default FollowButton
