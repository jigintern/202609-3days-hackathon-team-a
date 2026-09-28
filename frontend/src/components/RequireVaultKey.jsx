import { Navigate } from 'react-router-dom'
import { useVault } from '../hooks/useVault.jsx'

// リロードで鍵が消えるため、アンロック画面へ戻す(SPEC 4.7 の再認証は必須)
function RequireVaultKey({ children }) {
  const { unlocked } = useVault()

  if (!unlocked) {
    return <Navigate to="/vault/unlock" replace />
  }

  return children
}

export default RequireVaultKey
