# Spotify Randomizer

A small PWA that shuffles a Spotify playlist (or your Liked Songs) and writes the result to a
separate playlist, so you can play it in order instead of relying on Spotify's shuffle.

Runs entirely in the browser. Spotify login uses the Authorization Code flow with PKCE, so there is
no client secret and no backend.

## Development

```sh
npm install
npm run dev      # http://127.0.0.1:5173/spotify-randomizer/
npm run check    # type-check
npm test         # unit tests
npm run build    # production build into dist/
npm run preview  # serve the production build at http://127.0.0.1:4173/spotify-randomizer/
npm run icons    # regenerate PWA icons from public/favicon.svg
```

The dev server binds to `127.0.0.1` on purpose: Spotify does not accept `localhost` redirect URIs.

## Deployment

Every push to `main` is built and deployed to GitHub Pages by
[.github/workflows/deploy.yml](.github/workflows/deploy.yml).
