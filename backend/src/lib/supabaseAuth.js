import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "./env.js";

const jwks = createRemoteJWKSet(
  new URL(`${env.supabaseUrl}/auth/v1/.well-known/jwks.json`)
);

const issuer = `${env.supabaseUrl}/auth/v1`;

/**
 * SupabaseのアクセストークンをJWKSで検証し、{ id, email } を返す。
 * 検証に失敗した場合は例外を投げる。
 */
export async function verifySupabaseAccessToken(token) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: "authenticated",
  });

  return {
    id: payload.sub,
    email: payload.email,
  };
}
