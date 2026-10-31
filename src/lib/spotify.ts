// Thin wrapper around the Spotify Web API.
// https://developer.spotify.com/documentation/web-api

import { getAccessToken } from './auth'

const API_URL = 'https://api.spotify.com/v1'

export interface User {
  id: string
  display_name: string | null
}

async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const token = await getAccessToken(retried)
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  })

  if (response.status === 401 && !retried) {
    // Token was rejected even though we thought it was valid; refresh and try once more.
    return api(path, init, true)
  }
  if (response.status === 429) {
    const waitSeconds = Number(response.headers.get('Retry-After') ?? '1')
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))
    return api(path, init, retried)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(`Spotify API error ${response.status}: ${body.error?.message ?? response.statusText}`)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export function getCurrentUser(): Promise<User> {
  return api('/me')
}
