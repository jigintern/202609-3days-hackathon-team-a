import { useState } from 'react'

// 画像URLは管理画面で手入力するため、URLが切れていても名前だけは出るようにする
function ArtistThumbnail({ artist, size = 40 }) {
  const [failed, setFailed] = useState(false)

  return (
    <span>
      {artist.imageUrl && !failed && (
        <img
          src={artist.imageUrl}
          alt=""
          width={size}
          height={size}
          style={{ objectFit: 'cover', verticalAlign: 'middle', marginRight: 8 }}
          onError={() => setFailed(true)}
        />
      )}
      {artist.name}
    </span>
  )
}

export default ArtistThumbnail
