import { useEffect } from 'react'

function ImageLightbox({ src, onClose }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <button type="button" className="lightbox" onClick={onClose} aria-label="画像を閉じる">
      <img src={src} alt="" />
    </button>
  )
}

export default ImageLightbox
