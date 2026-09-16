import { Link } from 'react-router-dom'
import FollowButton from './FollowButton.jsx'

function ArtistListItem({ artist, onFollowChange }) {
  return (
    <li className="card artist-card">
      <Link to={`/artists/${artist.id}`}>{artist.name}</Link>
      <FollowButton
        artistId={artist.id}
        isFollowing={artist.isFollowing}
        onChange={(isFollowing) => onFollowChange(artist.id, isFollowing)}
      />
    </li>
  )
}

export default ArtistListItem
