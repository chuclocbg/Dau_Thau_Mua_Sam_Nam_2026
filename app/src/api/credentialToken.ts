import { createHmac, timingSafeEqual } from 'node:crypto'

// ── Credential Token — Phase X.16 Step 1 ────────────────────────────────────────
// Per X16_PROTOCOL_DECISION.md (Option A: stdlib-only HMAC bearer token, no new dependency):
// signToken()/verifyToken() are pure functions -- the signing secret is an explicit parameter,
// never read from process.env/config here, so this module stays isolated and unit-testable in
// the manner X16_SCOPING_REPORT.md's Step 2 requires. Wiring the secret from config and calling
// verifyToken() from src/api/httpPrincipalResolver.ts is a later, separate step (ADR Step 3
// equivalent) -- this file is not imported by anything yet.
//
// Token shape: `${base64url(JSON payload)}.${base64url(HMAC-SHA256 signature)}`. Signature covers
// the encoded payload bytes exactly (not the decoded JSON), so any bit-flip in transit or storage
// invalidates it. timingSafeEqual() is used for the signature comparison per
// X16_PROTOCOL_DECISION.md's Acceptance Criteria #1 (never a direct ===/string comparison).

export interface TokenPayload {
  readonly subject: string
  readonly issuedAt: number
  readonly expiresAt: number
}

export type VerifyTokenResult =
  | { readonly valid: true; readonly payload: TokenPayload }
  | { readonly valid: false; readonly reason: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' }

function toBase64Url(input: Buffer): string {
  return input.toString('base64url')
}

function sign(secret: string, payloadEncoded: string): Buffer {
  return createHmac('sha256', secret).update(payloadEncoded).digest()
}

export function signToken(secret: string, subject: string, ttlSeconds: number, now: number = Date.now()): string {
  const payload: TokenPayload = { subject, issuedAt: now, expiresAt: now + ttlSeconds * 1000 }
  const payloadEncoded = toBase64Url(Buffer.from(JSON.stringify(payload), 'utf-8'))
  const signatureEncoded = toBase64Url(sign(secret, payloadEncoded))
  return `${payloadEncoded}.${signatureEncoded}`
}

export function verifyToken(secret: string, token: string, now: number = Date.now()): VerifyTokenResult {
  const parts = token.split('.')
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    return { valid: false, reason: 'MALFORMED' }
  }
  const [payloadEncoded, signatureEncoded] = parts

  let providedSignature: Buffer
  try {
    providedSignature = Buffer.from(signatureEncoded, 'base64url')
  } catch {
    return { valid: false, reason: 'MALFORMED' }
  }
  const expectedSignature = sign(secret, payloadEncoded)
  if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) {
    return { valid: false, reason: 'BAD_SIGNATURE' }
  }

  let payload: TokenPayload
  try {
    const decoded = Buffer.from(payloadEncoded, 'base64url').toString('utf-8')
    const parsed = JSON.parse(decoded) as Partial<TokenPayload>
    if (typeof parsed.subject !== 'string' || typeof parsed.issuedAt !== 'number' || typeof parsed.expiresAt !== 'number') {
      return { valid: false, reason: 'MALFORMED' }
    }
    payload = { subject: parsed.subject, issuedAt: parsed.issuedAt, expiresAt: parsed.expiresAt }
  } catch {
    return { valid: false, reason: 'MALFORMED' }
  }

  if (now > payload.expiresAt) {
    return { valid: false, reason: 'EXPIRED' }
  }
  return { valid: true, payload }
}
