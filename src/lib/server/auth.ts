import bcrypt from 'bcryptjs'
import { dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { redirect, type RequestEvent } from '@sveltejs/kit'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export type Role = 'landlord' | 'caretaker'

export interface SessionPayload {
  userId: string
  role: Role
  name: string
  email: string
  phone: string
}

export interface TempPayload {
  userId: string
  maskedPhone: string
  flow?: 'register' | 'login' | 'login_unverified'
}

export interface PostRegisterPayload {
  userId: string
}

const SESSION_COOKIE = 'kodii_session'
const TEMP_COOKIE = 'kodii_temp'
const POST_REGISTER_COOKIE = 'kodii_post_register'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7
const TEMP_MAX_AGE = 60 * 15
const POST_REGISTER_MAX_AGE = 60 * 10

function getSessionSecret() {
  if (!env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is not set')
  }

  return new TextEncoder().encode(env.SESSION_SECRET)
}

function cookieOptions(maxAge: number) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: !dev,
    maxAge,
  }
}

function isSessionPayload(payload: JWTPayload): payload is JWTPayload & SessionPayload {
  return (
    typeof payload.userId === 'string' &&
    (payload.role === 'landlord' || payload.role === 'caretaker') &&
    typeof payload.name === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.phone === 'string'
  )
}

function isTempPayload(payload: JWTPayload): payload is JWTPayload & TempPayload {
  const hasCore = typeof payload.userId === 'string' && typeof payload.maskedPhone === 'string'
  const hasValidFlow =
    payload.flow === undefined ||
    payload.flow === 'register' ||
    payload.flow === 'login' ||
    payload.flow === 'login_unverified'

  return hasCore && hasValidFlow
}

function isPostRegisterPayload(
  payload: JWTPayload,
): payload is JWTPayload & PostRegisterPayload {
  return typeof payload.userId === 'string'
}

/** Generates a random 6-digit OTP code. */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/** Hashes a password using bcryptjs with 12 salt rounds. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

/** Compares a plain password against a bcrypt hash. */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

/** Validates password strength rules used by auth forms. */
export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' }
  }

  if (!STRONG_PASSWORD_REGEX.test(password)) {
    return {
      valid: false,
      message:
        'Password must include uppercase, lowercase, number, and a special character',
    }
  }

  return { valid: true }
}

/** Normalizes Kenyan phone numbers into E.164 (+2547XXXXXXXX). */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s()-]/g, '')

  if (/^\+254[17]\d{8}$/.test(cleaned)) return cleaned
  if (/^254[17]\d{8}$/.test(cleaned)) return `+${cleaned}`
  if (/^0[17]\d{8}$/.test(cleaned)) return `+254${cleaned.slice(1)}`
  if (/^[17]\d{8}$/.test(cleaned)) return `+254${cleaned}`

  throw new Error('INVALID_PHONE')
}

/** Masks an E.164 phone number to a safe display format. */
export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone)
  const lastFour = normalized.slice(-4)
  return `+254***${lastFour}`
}

/** Creates and sets a signed session cookie. */
export async function createSession(event: RequestEvent, payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSessionSecret())

  event.cookies.set(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE))
}

/** Reads and verifies the signed session cookie. */
export async function getSession(event: RequestEvent): Promise<SessionPayload | null> {
  const token = event.cookies.get(SESSION_COOKIE)
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSessionSecret())
    if (!isSessionPayload(payload)) return null

    return {
      userId: payload.userId,
      role: payload.role,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
    }
  } catch {
    return null
  }
}

/** Requires an authenticated session or redirects to /login. */
export async function requireAuth(event: RequestEvent): Promise<SessionPayload> {
  const session = await getSession(event)
  if (!session) {
    throw redirect(302, '/login')
  }

  return session
}

/** Requires a specific role or redirects to /login. */
export async function requireRole(event: RequestEvent, role: Role): Promise<SessionPayload> {
  const session = await requireAuth(event)
  if (session.role !== role) {
    throw redirect(302, '/login')
  }

  return session
}

/** Clears the session cookie. */
export function clearSession(event: RequestEvent): void {
  event.cookies.delete(SESSION_COOKIE, { path: '/' })
}

/** Creates and sets a signed temporary auth cookie. */
export async function setTempCookie(event: RequestEvent, payload: TempPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getSessionSecret())

  event.cookies.set(TEMP_COOKIE, token, cookieOptions(TEMP_MAX_AGE))
}

/** Reads and verifies the signed temporary auth cookie. */
export async function getTempCookie(event: RequestEvent): Promise<TempPayload | null> {
  const token = event.cookies.get(TEMP_COOKIE)
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSessionSecret())
    if (!isTempPayload(payload)) return null

    return {
      userId: payload.userId,
      maskedPhone: payload.maskedPhone,
      flow: payload.flow,
    }
  } catch {
    return null
  }
}

/** Clears the temporary auth cookie. */
export function clearTempCookie(event: RequestEvent): void {
  event.cookies.delete(TEMP_COOKIE, { path: '/' })
}

/** Creates and sets a signed post-register cookie to allow first login without a second OTP. */
export async function setPostRegisterCookie(
  event: RequestEvent,
  payload: PostRegisterPayload,
): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(getSessionSecret())

  event.cookies.set(POST_REGISTER_COOKIE, token, cookieOptions(POST_REGISTER_MAX_AGE))
}

/** Reads and verifies the signed post-register cookie. */
export async function getPostRegisterCookie(
  event: RequestEvent,
): Promise<PostRegisterPayload | null> {
  const token = event.cookies.get(POST_REGISTER_COOKIE)
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSessionSecret())
    if (!isPostRegisterPayload(payload)) return null

    return {
      userId: payload.userId,
    }
  } catch {
    return null
  }
}

/** Clears the post-register cookie. */
export function clearPostRegisterCookie(event: RequestEvent): void {
  event.cookies.delete(POST_REGISTER_COOKIE, { path: '/' })
}
