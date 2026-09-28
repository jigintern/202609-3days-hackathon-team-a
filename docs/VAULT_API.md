# パスワード管理（Vault）API仕様

- 対象: フロントエンド実装者、およびコーディングを行うAIアシスタント
- 関連: [SPEC_1.md](./SPEC_1.md) 4.7「パスワード管理（サブ機能）」
- 最終更新: 2026-09-15

---

## 0. 設計方針（最初に必ず読むこと）

SPEC_1.md 4.7 の **案B: サーバー保存（クライアント暗号化）** を採用した。

この機能は実在するチケットサイトの会員番号やパスワードを扱う。したがって次の原則を守ること。

> **サーバーは復号鍵を一切持たない。APIには暗号文しか送らない。**

- サイト名・会員番号・パスワードを含むすべての項目は、**フロント側で暗号化してから**送信する
- 平文をリクエストボディに入れてはならない。`{ "password": "abc123" }` のようなリクエストは設計違反
- サーバーはDBに暗号文をそのまま置くだけで、中身を読む手段を持たない
- マスターパスワードの照合も**フロント側で行う**（サーバーは照合できない）

サーバー側は「送られてきた値が暗号文の形をしているか」だけを検証する（IVが12バイトか、暗号文が最低長を満たすか）。これは平文を誤って送る事故に対する最低限の歯止めであって、暗号化を代行してくれるものではない。

デモの際は**実在のアカウント情報を入力せず、ダミーデータを使うこと**（SPEC_1.md 4.7 に明記）。

---

## 1. 暗号仕様

以下の通りに実装すること。ここがサーバーと食い違うと復号できなくなる。

### 1.1 鍵導出（KDF）

| 項目 | 値 |
| --- | --- |
| アルゴリズム | PBKDF2-HMAC-SHA256 |
| 入力 | マスターパスワード（UTF-8） |
| salt | 16バイトのランダム値。初回セットアップ時に生成し、`kdfSalt` としてサーバーに保存する |
| 反復回数 | 初回セットアップ時に決めて `kdfIterations` として保存する。**推奨値は 600000** |
| 出力 | AES-GCM 用の256bit鍵 |

導出した鍵は**メモリ上にのみ保持する**。`localStorage` / `sessionStorage` / IndexedDB / Cookie のいずれにも保存しない。React なら Context か module スコープの変数に置き、リロードで消えてよい（再度アンロックさせる）。

`crypto.subtle.deriveKey` の `extractable` は `false` にすること。

### 1.2 暗号化・復号

| 項目 | 値 |
| --- | --- |
| アルゴリズム | AES-GCM（256bit鍵） |
| IV | **12バイトのランダム値。暗号化のたびに必ず新しく生成する** |
| 平文 | UTF-8 でエンコードした JSON 文字列 |
| エンコード | IV・暗号文とも標準base64（`+` `/` と `=` パディング。base64urlではない） |

> IVの使い回しはAES-GCMでは致命的な脆弱性になる。項目を更新するときも必ず新しいIVを生成すること。

### 1.3 保存する平文JSONの形

`cipherText` を復号すると、次の形のJSONが得られるようにする。

```json
{
  "siteName": "チケットぴあ",
  "siteUrl": "https://t.pia.jp",
  "credentialType": "memberId",
  "credentialValue": "1234567890",
  "password": "dummy-password",
  "note": "推し活用のサブ垢"
}
```

| フィールド | 必須 | 説明 |
| --- | --- | --- |
| `siteName` | 必須 | サイト名。一覧の表示名に使う |
| `siteUrl` | 任意 | サイトのURL |
| `credentialType` | 必須 | `"memberId"`（会員番号）/ `"email"`（メールアドレス）/ `"phone"`（電話番号）のいずれか |
| `credentialValue` | 必須 | 上記種別に対応する値 |
| `password` | 必須 | パスワード |
| `note` | 任意 | 備考 |

このJSONの構造は**フロント側だけの取り決め**であり、サーバーは検証しない。項目を増やしたくなった場合はフロント内で完結して変更できる（**バックエンドの変更もマイグレーションも不要**）。

### 1.3.1 credentialType と入力フォームの対応

サイトによってログインに使う情報が違うため、登録・編集画面では次の3つから種別を選ばせる。選んだ種別に応じて、値の入力欄のラベルと `type` を切り替える。パスワード欄は種別によらず常に表示する。

| `credentialType` | 画面上のラベル | 入力欄の `type` | 例 |
| --- | --- | --- | --- |
| `"email"` | メールアドレス | `email` | `oshi@example.com` |
| `"memberId"` | 会員番号 | `text` | `1234567890` |
| `"phone"` | 電話番号 | `tel` | `09012345678` |

つまり1件の登録内容は次のいずれかの組み合わせになる。

```
サイト名（＋URL） + メールアドレス + パスワード
サイト名（＋URL） + 会員番号     + パスワード
サイト名（＋URL） + 電話番号     + パスワード
```

一覧では `siteName` と、`credentialType` に応じたラベル付きの `credentialValue` を表示し、`password` はマスク表示にする（コピーボタンで取り出せるようにする）。

種別の選択はラジオボタンでもセレクトボックスでもよい。既定値は `"email"` とする。

### 1.4 マスターパスワードの検証（verifier）

サーバーはマスターパスワードの正否を判定できないため、フロントが次の方法で判定する。

- 初回セットアップ時: 固定文字列 `oshikatsu-vault-v1` を導出鍵で暗号化し、`verifierIv` / `verifierCipher` として保存する
- アンロック時: 入力されたマスターパスワードから鍵を導出し、`verifierCipher` の復号を試みる
  - 復号に成功し、中身が `oshikatsu-vault-v1` と一致 → マスターパスワードは正しい
  - 復号に失敗（AES-GCMの認証タグ検証エラーで例外が飛ぶ） → マスターパスワードが違う

---

## 2. 画面フローと呼び出し順

```
/vault/unlock に入る
  ↓
GET /api/vault/profile
  ├─ 404 NOT_FOUND → 未設定。初回セットアップ画面へ
  │    マスターパスワードを2回入力させる
  │      → salt生成・鍵導出・verifier作成 → POST /api/vault/profile
  │      → 「忘れると復旧できない」旨を必ず画面に表示する
  └─ 200 → マスターパスワード入力画面
       → 鍵導出 → verifierを復号して照合
         ├─ 失敗 → エラー表示（サーバーへの問い合わせは不要）
         └─ 成功 → 鍵をメモリに保持して /vault へ
  ↓
GET /api/vault/entries で暗号文を全件取得し、メモリ上の鍵で復号して一覧表示
  ↓
追加 → 暗号化 → POST /api/vault/entries
編集 → 暗号化（新しいIVで） → PATCH /api/vault/entries/:entryId
削除 → DELETE /api/vault/entries/:entryId
```

一覧・詳細ではパスワードをマスク表示にし、コピーボタンで取り出せるようにする（SPEC_1.md 4.7）。

ログイン中であっても、一覧に入る前のマスターパスワード再認証は**必須**。

---

## 3. APIエンドポイント

すべて認証が必要（`Authorization: Bearer <Supabaseのアクセストークン>`）。ベースパスは `/api`。

### GET /api/vault/profile

鍵導出パラメータとverifierを取得する。アンロック画面の最初に呼ぶ。

**レスポンス 200**

```json
{
  "profile": {
    "kdfSalt": "c2FsdDE2Ynl0ZXNhYWFh",
    "kdfIterations": 600000,
    "verifierIv": "MTIzNDU2Nzg5MDEy",
    "verifierCipher": "3q2+7wAAAAAAAAAAAAAAAAAAAAAAAAAA"
  }
}
```

**404 NOT_FOUND** … 保管庫が未設定。初回セットアップ画面へ誘導する。

---

### POST /api/vault/profile

初回セットアップ。マスターパスワードを決めた直後に1度だけ呼ぶ。

**リクエスト**

```json
{
  "kdfSalt": "（16バイトのランダム値のbase64）",
  "kdfIterations": 600000,
  "verifierIv": "（12バイトのIVのbase64）",
  "verifierCipher": "（oshikatsu-vault-v1 を暗号化したもののbase64）"
}
```

**レスポンス 201** … `GET /api/vault/profile` と同じ形

**409 CONFLICT** … 既に設定済み

---

### GET /api/vault/entries

保管している項目を全件取得する。ページネーションは無い。

**レスポンス 200**

```json
{
  "entries": [
    {
      "id": "0f4a...",
      "iv": "MTIzNDU2Nzg5MDEy",
      "cipherText": "3q2+7wAAAA...",
      "createdAt": "2026-09-15T06:00:00.000Z",
      "updatedAt": "2026-09-15T06:00:00.000Z"
    }
  ]
}
```

並び順は作成日の昇順。サイト名での並べ替えはサーバーにはできない（暗号文のため）ので、復号後にフロント側で行うこと。

---

### POST /api/vault/entries

項目を追加する。

**リクエスト**

```json
{
  "iv": "（12バイトのIVのbase64）",
  "cipherText": "（平文JSONを暗号化したもののbase64）"
}
```

**レスポンス 201**

```json
{ "entry": { "id": "...", "iv": "...", "cipherText": "...", "createdAt": "...", "updatedAt": "..." } }
```

**400 VALIDATION_ERROR** … IVが12バイトでない／暗号文として不正／`POST /api/vault/profile` がまだ

---

### PATCH /api/vault/entries/:entryId

項目を更新する。部分更新はできず、暗号文まるごとの差し替えになる。**新しいIVで暗号化し直すこと。**

リクエスト・レスポンスは `POST /api/vault/entries` と同じ形（レスポンスは200）。

**404 NOT_FOUND** / **403 FORBIDDEN**（他人の項目）

---

### DELETE /api/vault/entries/:entryId

項目を削除する。論理削除ではなく物理削除。

**レスポンス 204**（ボディ無し）

---

### DELETE /api/vault

保管庫をまるごと消す。**マスターパスワードを忘れた場合の唯一の復旧手段**（中身は失われ、作り直しになる）。

profileとentriesの両方が消える。実行前に必ず確認ダイアログを出すこと。

**レスポンス 204**（ボディ無し）

---

## 4. エラーレスポンス

形式は他のAPIと共通（SPEC_1.md 7章）。

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "ivは12バイトである必要があります" } }
```

| ステータス | code | 主な原因 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | IV・暗号文の形式が不正、保管庫が未設定のまま項目を追加した |
| 401 | `UNAUTHORIZED` | トークンが無い・不正・期限切れ |
| 403 | `PROFILE_REQUIRED` | アプリのプロフィール未作成（`POST /api/auth/profile` が先） |
| 403 | `FORBIDDEN` | 他人の項目を操作しようとした |
| 404 | `NOT_FOUND` | 保管庫が未設定（`GET /api/vault/profile`）、項目が存在しない |
| 409 | `CONFLICT` | 保管庫が既に設定済み |

既存の `frontend/src/lib/api.js` の `apiFetch` がそのまま使える（`ApiError` の `status` と `code` で分岐する）。

---

## 5. 実装例（WebCrypto）

```js
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const VERIFIER_PLAINTEXT = 'oshikatsu-vault-v1'
const DEFAULT_ITERATIONS = 600000

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
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 毎回新しく生成する
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

// 初回セットアップ: POST /api/vault/profile に渡す値を組み立てる
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

// アンロック: 正しければ鍵を返し、違えば null を返す
export async function unlockVault(masterPassword, profile) {
  const key = await deriveKey(masterPassword, profile.kdfSalt, profile.kdfIterations)

  try {
    const value = await decryptJson(key, profile.verifierIv, profile.verifierCipher)
    return value === VERIFIER_PLAINTEXT ? key : null
  } catch {
    return null // 復号失敗 = マスターパスワードが違う
  }
}
```

---

## 6. やってはいけないこと

- 平文の会員番号・パスワードをAPIに送る
- 導出鍵やマスターパスワードを `localStorage` / `sessionStorage` / IndexedDB / Cookie に保存する
- 同じIVを2回使う（更新時に前のIVを使い回す）
- マスターパスワードをアプリのログインパスワードと共用させる
- サーバーにマスターパスワードの照合を期待する（できない）
- デモで実在のチケットサイトのアカウント情報を入力する

---

## 7. 補足

- 鍵導出（PBKDF2 600000回）はブラウザで1秒前後かかる。アンロック中はローディング表示を出すとよい
- 一定時間操作が無ければ鍵をメモリから破棄する自動ロックを入れてもよい（MVPでは任意）
- 暗号文は1項目あたり8KBまで。通常の用途では十分だが、備考に長文を入れると超える可能性がある
