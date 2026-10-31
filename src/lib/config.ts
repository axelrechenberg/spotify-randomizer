// The Client ID is public by design (it appears in every login URL), so it is safe to commit.
// There is deliberately no client secret anywhere in this app: PKCE replaces it.
export const CLIENT_ID = '5846c677b0224524b8bb4a941a9740d1'

export const SCOPES = [
  'playlist-read-private',
  'playlist-modify-private',
  'playlist-modify-public',
  'user-library-read',
]

// The app's own root URL, e.g. http://127.0.0.1:5173/spotify-randomizer/ in dev.
// It must exactly match one of the redirect URIs registered in the Spotify dashboard.
export const REDIRECT_URI = new URL(import.meta.env.BASE_URL, window.location.origin).href
