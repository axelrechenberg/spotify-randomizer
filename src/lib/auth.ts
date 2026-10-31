// Spotify login using the Authorization Code flow with PKCE.
// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

import { CLIENT_ID, REDIRECT_URI, SCOPES } from './config'

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'

const TOKENS_KEY = 'spotify-tokens'
const VERIFIER_KEY = 'pkce-verifier'
const STATE_KEY = 'pkce-state'

// Refresh slightly before the real expiry so a request never goes out with a dying token.
const EXPIRY_MARGIN_MS = 60_000

interface Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function randomString(byteLength: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

async function sha256(text: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return new Uint8Array(digest)
}

function loadTokens(): Tokens | null {
  const raw = localStorage.getItem(TOKENS_KEY)
  return raw ? (JSON.parse(raw) as Tokens) : null
}

function saveTokens(response: TokenResponse, previousRefreshToken?: string): void {
  const tokens: Tokens = {
    accessToken: response.access_token,
    // Spotify may or may not rotate the refresh token; keep the old one if it doesn't.
    refreshToken: response.refresh_token ?? previousRefreshToken ?? '',
    expiresAt: Date.now() + response.expires_in * 1000,
  }
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(`Token request failed: ${body.error_description ?? body.error ?? response.status}`)
  }
  return response.json()
}

export function isLoggedIn(): boolean {
  return loadTokens() !== null
}

/** Redirects the browser to Spotify's login page. */
export async function login(): Promise<void> {
  const verifier = randomString(64)
  const state = randomString(16)
  // localStorage rather than sessionStorage: on some phones the redirect comes back in a new tab.
  localStorage.setItem(VERIFIER_KEY, verifier)
  localStorage.setItem(STATE_KEY, state)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: base64url(await sha256(verifier)),
    state,
  })
  window.location.assign(`${AUTHORIZE_URL}?${params}`)
}

export function logout(): void {
  localStorage.removeItem(TOKENS_KEY)
}

/**
 * If the current URL is Spotify's redirect back to us, exchanges the code for tokens.
 * Does nothing on a normal page load.
 */
export async function handleRedirect(): Promise<void> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  if (!code && !error) return

  const expectedState = localStorage.getItem(STATE_KEY)
  const verifier = localStorage.getItem(VERIFIER_KEY)
  localStorage.removeItem(STATE_KEY)
  localStorage.removeItem(VERIFIER_KEY)
  // Remove ?code=… from the address bar so a reload doesn't try to reuse it.
  window.history.replaceState(null, '', REDIRECT_URI)

  if (error) throw new Error(`Spotify login failed: ${error}`)
  if (!verifier || url.searchParams.get('state') !== expectedState) {
    throw new Error('Login response did not match the login request. Please try again.')
  }

  const response = await requestToken({
    grant_type: 'authorization_code',
    code: code!,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  })
  saveTokens(response)
}

let refreshInFlight: Promise<string> | null = null

async function refresh(tokens: Tokens): Promise<string> {
  try {
    const response = await requestToken({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    })
    saveTokens(response, tokens.refreshToken)
    return response.access_token
  } catch (e) {
    // A refresh token that no longer works means the user has to log in again.
    logout()
    throw e
  }
}

/** Returns a valid access token, refreshing it if needed. */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  const tokens = loadTokens()
  if (!tokens) throw new Error('Not logged in')
  if (!forceRefresh && Date.now() < tokens.expiresAt - EXPIRY_MARGIN_MS) return tokens.accessToken

  // Several API calls may notice the expiry at once; let them share one refresh request.
  refreshInFlight ??= refresh(tokens).finally(() => (refreshInFlight = null))
  return refreshInFlight
}
