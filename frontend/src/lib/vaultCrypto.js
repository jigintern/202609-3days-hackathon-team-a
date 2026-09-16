// 暗号仕様は docs/VAULT_API.md「1. 暗号仕様」に従う。サーバーは復号鍵を持たない。
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const VERIFIER_PLAINTEXT = 'oshikatsu-vault-v1'
export const DEFAULT_ITERATIONS = 600000

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

export async function deriveKey(masterPassword, kdfSaltBase64, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(kdfSaltBase64),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // extractable: 鍵を取り出せないようにする
    ['encrypt', 'decrypt'],
  )
}

export async function encryptJson(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12)) // IVの使い回しは致命的なので毎回生成する
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(value)),
  )

  return {
    iv: bytesToBase64(iv),
    cipherText: bytesToBase64(new Uint8Array(cipher)),
  }
}

export async function decryptJson(key, ivBase64, cipherTextBase64) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivBase64) },
    key,
    base64ToBytes(cipherTextBase64),
  )

  return JSON.parse(decoder.decode(plain))
}

export async function buildVaultProfile(masterPassword) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const kdfSalt = bytesToBase64(salt)
  const key = await deriveKey(masterPassword, kdfSalt, DEFAULT_ITERATIONS)
  const verifier = await encryptJson(key, VERIFIER_PLAINTEXT)

  return {
    payload: {
      kdfSalt,
      kdfIterations: DEFAULT_ITERATIONS,
      verifierIv: verifier.iv,
      verifierCipher: verifier.cipherText,
    },
    key,
  }
}

/// マスターパスワードが正しければ鍵を返す。誤っていれば null(サーバーでは照合できない)
export async function unlockVault(masterPassword, profile) {
  const key = await deriveKey(masterPassword, profile.kdfSalt, profile.kdfIterations)

  try {
    const value = await decryptJson(key, profile.verifierIv, profile.verifierCipher)
    return value === VERIFIER_PLAINTEXT ? key : null
  } catch {
    return null
  }
}
