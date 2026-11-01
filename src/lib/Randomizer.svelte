<script lang="ts">
  import { onMount } from 'svelte'
  import ArtistBoosts from './ArtistBoosts.svelte'
  import { pickTracks, type Boosts } from './bias'
  import { loadTracks, sameSource, saveToTarget, selectableSources, sourceName, type Source } from './randomizer'
  import SourcePicker from './SourcePicker.svelte'
  import { getMyPlaylists, type Playlist, type Track, type User } from './spotify'

  type Progress = { done: number; total: number }

  let { user }: { user: User } = $props()

  // $state.raw: these are only ever replaced as a whole, never mutated, so Svelte doesn't need to
  // track every nested property. That also keeps the preview's hot loop fast.
  let playlists = $state.raw<Playlist[]>([])
  let tracks = $state.raw<Track[] | null>(null)

  let loadingPlaylists = $state(true)
  let selected = $state<Source | null>(null)
  let reading = $state<Progress | null>(null)
  let count = $state(0)
  let boosts = $state<Boosts>({})
  let writing = $state<Progress | null>(null)
  let result = $state<Playlist | null>(null)
  let error = $state<string | null>(null)

  // Recomputed automatically whenever the values they read change.
  let sources = $derived(selectableSources(playlists, user))
  let validCount = $derived(Number.isInteger(count) && count >= 1 && count <= (tracks?.length ?? 0))
  let isSubset = $derived(validCount && count < (tracks?.length ?? 0))

  function showError(e: unknown) {
    error = e instanceof Error ? e.message : String(e)
  }

  async function loadPlaylists() {
    playlists = await getMyPlaylists()
  }

  onMount(async () => {
    try {
      await loadPlaylists()
    } catch (e) {
      showError(e)
    } finally {
      loadingPlaylists = false
    }
  })

  async function select(source: Source) {
    selected = source
    tracks = null
    boosts = {}
    result = null
    error = null
    reading = { done: 0, total: 0 }
    try {
      const loaded = await loadTracks(source, (done, total) => {
        if (sameSource(source, selected)) reading = { done, total }
      })
      // The user may have gone back and picked another source while this one was loading.
      if (!sameSource(source, selected)) return
      tracks = loaded
      count = loaded.length
    } catch (e) {
      if (sameSource(source, selected)) showError(e)
    } finally {
      if (sameSource(source, selected)) reading = null
    }
  }

  function changeSource() {
    selected = null
    tracks = null
    reading = null
    result = null
    error = null
  }

  async function create() {
    if (!selected || !tracks || !validCount) return
    error = null
    result = null
    const picked = pickTracks(tracks, count, isSubset ? $state.snapshot(boosts) : {})
    writing = { done: 0, total: picked.length }
    try {
      result = await saveToTarget(selected, picked, playlists, user, (done, total) => {
        writing = { done, total }
      })
      // Reload so a newly created target playlist is found (and reused) on the next run.
      await loadPlaylists()
    } catch (e) {
      showError(e)
    } finally {
      writing = null
    }
  }
</script>

{#if loadingPlaylists}
  <p>Loading your playlists…</p>
{:else if !selected}
  <SourcePicker playlists={sources} onselect={select} />
{:else}
  <div class="source">
    <div>
      <div class="hint">Shuffling</div>
      <strong>{sourceName(selected)}</strong>
    </div>
    <button class="link" disabled={writing !== null} onclick={changeSource}>Change</button>
  </div>

  {#if reading}
    <p>Loading tracks… {reading.done}{reading.total ? ` / ${reading.total}` : ''}</p>
  {:else if tracks}
    <h2 id="size-label">Tracks to include</h2>
    <div class="size-inputs" role="group" aria-labelledby="size-label">
      <input type="range" min="1" max={tracks.length} bind:value={count} disabled={writing !== null} aria-label="Tracks to include" />
      <input class="field" type="number" min="1" max={tracks.length} bind:value={count} disabled={writing !== null} aria-label="Tracks to include" />
      <span class="muted">of {tracks.length}</span>
    </div>

    {#if isSubset}
      <ArtistBoosts {tracks} {count} bind:boosts disabled={writing !== null} />
    {:else}
      <p class="hint">Pick fewer tracks than the playlist has to boost specific artists.</p>
    {/if}

    <div class="panel">
      {#if error}
        <p class="error">{error}</p>
      {/if}
      {#if result}
        <p>
          Done! <a href={result.external_urls.spotify} target="_blank" rel="noopener">Open “{result.name}” in Spotify</a>
          and play it with shuffle <strong>off</strong>.
        </p>
      {/if}
      <button class="primary" disabled={!validCount || writing !== null} onclick={create}>
        {#if writing}
          Writing… {writing.done} / {writing.total}
        {:else if isSubset}
          Create playlist with {count} random tracks
        {:else}
          Create shuffled playlist
        {/if}
      </button>
    </div>
  {/if}
{/if}

{#if error && !tracks}
  <p class="error">{error}</p>
{/if}

<style>
  h2 {
    font-size: 1.1rem;
    margin: 1.5rem 0 0.5rem;
  }

  .source {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #1f1f1f;
    border-radius: 0.5rem;
  }

  .size-inputs {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  input[type='range'] {
    flex: 1;
    min-width: 0;
  }

  input[type='number'] {
    width: 5rem;
  }

  /* Stays at the bottom of the screen so the button is reachable under a long artist list. */
  .panel {
    position: sticky;
    bottom: 0;
    display: grid;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 1rem 0 calc(1rem + env(safe-area-inset-bottom));
    background: #121212;
    border-top: 1px solid #2a2a2a;
  }

  .panel p {
    margin: 0;
  }

  .panel a {
    color: #1ed760;
  }
</style>
