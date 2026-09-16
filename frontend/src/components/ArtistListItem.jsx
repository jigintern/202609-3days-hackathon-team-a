import { Link } from 'react-router-dom'
import FollowButton from './FollowButton.jsx'
import OshiButton from './OshiButton.jsx'

function ArtistListItem({ artist, onFollowChange, onOshiChange }) {
  return (
    <li className={`card artist-card${artist.isOshi ? ' is-oshi' : ''}`}>
      <Link to={`/artists/${artist.id}`}>{artist.name}</Link>
      <FollowButton
        artistId={artist.id}
        isFollowing={artist.isFollowing}
        onChange={(isFollowing) => onFollowChange(artist.id, isFollowing)}
      />
      {artist.isFollowing && (
        <OshiButton artistId={artist.id} isOshi={artist.isOshi} onOshiChange={onOshiChange} />
      )}
    </li>
  )
}

export default ArtistListItem
