import { createContext, useContext, useState } from 'react'

const VaultContext = createContext(null)

// 導出鍵はこのstateにのみ置く。保存するとマスターパスワードを知らなくても
// 復号できてしまうため、localStorage等には決して書かない(docs/VAULT_API.md 1.1)
export function VaultProvider({ children }) {
  const [key, setKey] = useState(null)

  const value = {
    key,
    unlocked: key !== null,
    unlock: setKey,
    lock: () => setKey(null),
  }

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}

export function useVault() {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used within VaultProvider')
  return ctx
}
