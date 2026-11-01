<script lang="ts">
  import { onMount } from 'svelte'
  import { randomize, selectableSources, sourceName, type Progress, type Source } from './randomizer'
  import { getMyPlaylists, playlistSize, type Playlist, type User } from './spotify'

  let { user }: { user: User } = $props()

  let playlists = $state<Playlist[]>([])
  let loading = $state(true)
  let selected = $state<Source | null>(null)
  let progress = $state<Progress | null>(null)
  let result = $state<Playlist | null>(null)
  let error = $state<string | null>(null)

  // Recomputed automatically whenever `playlists` changes.
  let sources = $derived(selectableSources(playlists, user))
  let running = $derived(progress !== null)

  async function loadPlaylists() {
    playlists = await getMyPlaylists()
  }

  onMount(async () => {
    try {
      await loadPlaylists()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      loading = false
    }
  })

  function isSelected(source: Source): boolean {
    if (!selected || selected.kind !== source.kind) return false
    return source.kind === 'liked' || (selected.kind === 'playlist' && selected.playlist.id === source.playlist.id)
  }

  async function run() {
    if (!selected) return
    error = null
    result = null
    progress = { phase: 'reading', done: 0, total: 0 }
    try {
      result = await randomize(selected, playlists, user, (p) => (progress = p))
      // Reload so a newly created target playlist is found (and reused) on the next run.
      await loadPlaylists()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      progress = null
    }
  }
</script>

{#snippet option(source: Source, count: number | null)}
  <li>
    <button class="option" class:selected={isSelected(source)} disabled={running} onclick={() => (selected = source)}>
      <span class="name">{sourceName(source)}</span>
      {#if count !== null}<span class="count">{count} tracks</span>{/if}
    </button>
  </li>
{/snippet}

{#if loading}
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

  <div class="actions">
    <button class="primary" disabled={!selected || running} onclick={run}>
      {#if progress?.phase === 'reading'}
        Reading… {progress.done}{progress.total ? ` / ${progress.total}` : ''}
      {:else if progress?.phase === 'writing'}
        Writing… {progress.done} / {progress.total}
      {:else}
        Shuffle
      {/if}
    </button>
  </div>
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

  .actions {
    position: sticky;
    bottom: 0;
    padding: 1rem 0 calc(1rem + env(safe-area-inset-bottom));
    background: #121212;
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
