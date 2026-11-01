<script lang="ts">
  import { sourceName, type Source } from './randomizer'
  import { playlistSize, type Playlist } from './spotify'

  let { playlists, onselect }: { playlists: Playlist[]; onselect: (source: Source) => void } = $props()
</script>

{#snippet option(source: Source, size: number | null)}
  <li>
    <button class="option" onclick={() => onselect(source)}>
      <span>{sourceName(source)}</span>
      {#if size !== null}<span class="muted">{size} tracks</span>{/if}
    </button>
  </li>
{/snippet}

<h2>Pick what to shuffle</h2>
<ul>
  {@render option({ kind: 'liked' }, null)}
  {#each playlists as playlist (playlist.id)}
    {@render option({ kind: 'playlist', playlist }, playlistSize(playlist))}
  {/each}
</ul>
<p class="hint">Only playlists you own or collaborate on can be shuffled — Spotify doesn't let apps read others.</p>

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
    text-align: left;
    background: #1f1f1f;
    border: none;
    border-radius: 0.5rem;
  }

  .option:hover {
    background: #2a2a2a;
  }

  .muted {
    white-space: nowrap;
  }
</style>
