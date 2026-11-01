<script lang="ts">
  import { artistStats, BOOST_LEVELS, fullyIncludedCount, previewBoosts, type Boost, type Boosts } from './bias'
  import type { Track } from './spotify'

  // `boosts` is $bindable: the parent passes it with bind:boosts and sees every change made here.
  let {
    tracks,
    count,
    boosts = $bindable(),
    disabled = false,
  }: { tracks: Track[]; count: number; boosts: Boosts; disabled?: boolean } = $props()

  const SUGGESTIONS = 8
  const SEARCH_RESULTS = 20

  let query = $state('')
  let preview = $state<Map<string, number> | null>(null)

  let artists = $derived(artistStats(tracks))
  let boosted = $derived(artists.filter((artist) => boosts[artist.id]))
  let candidates = $derived.by(() => {
    const unboosted = artists.filter((artist) => !boosts[artist.id])
    const q = query.trim().toLowerCase()
    if (!q) return unboosted.slice(0, SUGGESTIONS)
    return unboosted.filter((artist) => artist.name.toLowerCase().includes(q)).slice(0, SEARCH_RESULTS)
  })
  let fullyIncluded = $derived(fullyIncludedCount(tracks, boosts))

  // The preview runs the pick hundreds of times, so wait until the slider or boosts stop changing.
  $effect(() => {
    const current = $state.snapshot(boosts)
    const size = count
    if (Object.keys(current).length === 0) {
      preview = null
      return
    }
    const timer = setTimeout(() => (preview = previewBoosts(tracks, size, current)), 150)
    return () => clearTimeout(timer)
  })

  function setBoost(artistId: string, value: string) {
    if (value === '') delete boosts[artistId]
    else boosts[artistId] = (value === 'all' ? 'all' : Number(value)) as Boost
  }

  function addBoost(artistId: string) {
    boosts[artistId] = 2
    query = ''
  }
</script>

<section>
  <h2>Boost artists <span class="hint">(optional)</span></h2>

  {#if boosted.length > 0}
    <ul>
      {#each boosted as artist (artist.id)}
        {@const expected = preview?.get(artist.id)}
        <li class="row">
          <div class="artist">
            <span>{artist.name}</span>
            <span class="hint">
              {#if expected === undefined}
                {artist.trackCount} tracks
              {:else}
                ≈ {Math.round(expected)} of {artist.trackCount} tracks
                {#if boosts[artist.id] !== 'all'}
                  (≈ {Math.round((artist.trackCount * count) / tracks.length)} without boost)
                {/if}
              {/if}
            </span>
          </div>
          <select
            class="field"
            {disabled}
            value={String(boosts[artist.id])}
            onchange={(e) => setBoost(artist.id, e.currentTarget.value)}
          >
            {#each BOOST_LEVELS as level (level.value)}
              <option value={String(level.value)}>{level.label}</option>
            {/each}
            <option value="">Remove</option>
          </select>
        </li>
      {/each}
    </ul>
    {#if fullyIncluded > count}
      <p class="hint warning">
        The “All tracks” artists have {fullyIncluded} tracks, more than the {count} you picked, so a random
        {count} of them will be used.
      </p>
    {/if}
  {/if}

  <input class="field search" type="search" placeholder="Search artists…" bind:value={query} {disabled} />
  <ul>
    {#each candidates as artist (artist.id)}
      <li class="row">
        <div class="artist">
          <span>{artist.name}</span>
          <span class="hint">{artist.trackCount} tracks</span>
        </div>
        <button class="link" {disabled} onclick={() => addBoost(artist.id)}>Boost</button>
      </li>
    {:else}
      <li class="hint">No matching artists.</li>
    {/each}
  </ul>
</section>

<style>
  h2 {
    font-size: 1.1rem;
    margin: 1.5rem 0 0.5rem;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0 0 0.75rem;
    display: grid;
    gap: 0.25rem;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0.75rem;
    background: #1f1f1f;
    border-radius: 0.5rem;
  }

  .artist {
    display: grid;
    min-width: 0;
  }

  .artist > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
  }

  .warning {
    color: #f5c451;
  }
</style>
