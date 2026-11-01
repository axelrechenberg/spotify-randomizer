<script lang="ts">
  import { onMount } from 'svelte'
  import {
    createRandomPlaylist,
    loadTracks,
    sameSource,
    selectableSources,
    sourceName,
    type Source,
  } from './randomizer'
  import { getMyPlaylists, playlistSize, type Playlist, type Track, type User } from './spotify'

  type Progress = { done: number; total: number }

  let { user }: { user: User } = $props()

  let playlists = $state<Playlist[]>([])
  let loadingPlaylists = $state(true)
  let selected = $state<Source | null>(null)
  let tracks = $state<Track[] | null>(null)
  let reading = $state<Progress | null>(null)
  let count = $state(0)
  let writing = $state<Progress | null>(null)
  let result = $state<Playlist | null>(null)
  let error = $state<string | null>(null)

  // Recomputed automatically whenever the values they read change.
  let sources = $derived(selectableSources(playlists, user))
  let validCount = $derived(Number.isInteger(count) && count >= 1 && count <= (tracks?.length ?? 0))

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
    if (sameSource(source, selected)) return
    selected = source
    tracks = null
    result = null
    error = null
    reading = { done: 0, total: 0 }
    try {
      const loaded = await loadTracks(source, (done, total) => {
        if (sameSource(source, selected)) reading = { done, total }
      })
      // The user may have picked another source while this one was loading.
      if (!sameSource(source, selected)) return
      tracks = loaded
      count = loaded.length
    } catch (e) {
      if (sameSource(source, selected)) showError(e)
    } finally {
      if (sameSource(source, selected)) reading = null
    }
  }

  async function create() {
    if (!selected || !tracks || !validCount) return
    error = null
    result = null
    writing = { done: 0, total: count }
    try {
      result = await createRandomPlaylist(selected, tracks, count, playlists, user, (done, total) => {
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

{#snippet option(source: Source, size: number | null)}
  <li>
    <button
      class="option"
      class:selected={sameSource(source, selected)}
      disabled={writing !== null}
      onclick={() => select(source)}
    >
      <span class="name">{sourceName(source)}</span>
      {#if size !== null}<span class="count">{size} tracks</span>{/if}
    </button>
  </li>
{/snippet}

{#if loadingPlaylists}
  <p>Loading your playlists…</p>
{:else}
  <h2>Pick what to shuffle</h2>
  <ul>
    {@render option({ kind: 'liked' }, null)}
    {#each sources as playlist (playlist.id)}
      {@render option({ kind: 'playlist', playlist }, playlistSize(playlist))}
    {/each}
  </ul>
  <p class="hint">Only playlists you own or collaborate on can be shuffled — Spotify doesn't let apps read others.</p>
{/if}

{#if error}
  <p class="error">{error}</p>
{/if}

{#if result}
  <p class="result">
    Done! <a href={result.external_urls.spotify} target="_blank" rel="noopener">Open “{result.name}” in Spotify</a>
    and play it with shuffle <strong>off</strong>.
  </p>
{/if}

{#if selected}
  <div class="panel">
    {#if reading}
      <p>Loading {sourceName(selected)}… {reading.done}{reading.total ? ` / ${reading.total}` : ''}</p>
    {:else if tracks}
      <label class="size">
        <span>Tracks to include</span>
        <span class="size-inputs">
          <input type="range" min="1" max={tracks.length} bind:value={count} disabled={writing !== null} />
          <input type="number" min="1" max={tracks.length} bind:value={count} disabled={writing !== null} />
          <span class="count">of {tracks.length}</span>
        </span>
      </label>
      <button class="primary" disabled={!validCount || writing !== null} onclick={create}>
        {#if writing}
          Writing… {writing.done} / {writing.total}
        {:else if validCount && count < tracks.length}
          Create playlist with {count} random tracks
        {:else}
          Create shuffled playlist
        {/if}
      </button>
    {/if}
  </div>
{/if}

<style>
  h2 {
    font-size: 1.1rem;
    margin: 1.5rem 0 0.5rem;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.25rem;
  }

  .option {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    font: inherit;
    text-align: left;
    color: inherit;
    background: #1f1f1f;
    border: 2px solid transparent;
    border-radius: 0.5rem;
    cursor: pointer;
  }

  .option:hover:not(:disabled) {
    background: #2a2a2a;
  }

  .option.selected {
    border-color: #1ed760;
  }

  .count {
    color: #a7a7a7;
    white-space: nowrap;
  }

  .hint {
    font-size: 0.85rem;
    color: #a7a7a7;
  }

  /* Stays at the bottom of the screen so the controls are reachable under a long playlist list. */
  .panel {
    position: sticky;
    bottom: 0;
    display: grid;
    gap: 0.75rem;
    padding: 1rem 0 calc(1rem + env(safe-area-inset-bottom));
    background: #121212;
    border-top: 1px solid #2a2a2a;
  }

  .panel p {
    margin: 0;
  }

  .size {
    display: grid;
    gap: 0.25rem;
  }

  .size-inputs {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  input[type='range'] {
    flex: 1;
    min-width: 0;
    accent-color: #1ed760;
  }

  input[type='number'] {
    width: 5rem;
    font: inherit;
    padding: 0.25rem 0.5rem;
    color: inherit;
    background: #1f1f1f;
    border: 1px solid #3a3a3a;
    border-radius: 0.375rem;
  }

  .primary {
    width: 100%;
    font: inherit;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 999px;
    background: #1ed760;
    color: #000;
    cursor: pointer;
  }

  .primary:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .error {
    color: #ff6b6b;
  }

  .result a {
    color: #1ed760;
  }
</style>
