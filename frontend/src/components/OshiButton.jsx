import { setOshiArtist, unsetOshiArtist } from '../api/artists.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'

function OshiButton({ artistId, isOshi, onOshiChange }) {
  const { run, pending, error } = useAsyncAction(async () => {
    const action = isOshi ? unsetOshiArtist : setOshiArtist
    await action(artistId)
    onOshiChange(artistId, !isOshi)
  })

  return (
    <>
      <button type="button" className={isOshi ? 'btn-oshi' : 'btn-secondary'} onClick={run} disabled={pending}>
        {isOshi ? '最推し中' : '最推しにする'}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}

export default OshiButton
