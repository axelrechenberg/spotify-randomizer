<script lang="ts">
  import { newestAddedAt, RECENCY_PERIODS, RECENCY_STRENGTHS, type Recency } from './bias'
  import type { Track } from './spotify'

  type Settings = Exclude<Recency, null>

  // `recency` is $bindable: the parent passes it with bind:recency and sees every change made here.
  let {
    tracks,
    recency = $bindable(),
    disabled = false,
  }: { tracks: Track[]; recency: Recency; disabled?: boolean } = $props()

  // The settings are remembered while the switch is off, so turning it back on restores them.
  // svelte-ignore state_referenced_locally
  let settings = $state<Settings>(recency ?? { halfLifeDays: 30, strength: 4 })
  let enabled = $derived(recency !== null)

  let newest = $derived(newestAddedAt(tracks))
  // Less than a day between the oldest and the newest dated track: nothing to prefer.
  let noEffect = $derived(tracks.every((track) => track.addedAt === 0 || newest - track.addedAt < 24 * 60 * 60 * 1000))
  let periodLabel = $derived(RECENCY_PERIODS.find((period) => period.value === settings.halfLifeDays)?.label)

  function setEnabled(on: boolean) {
    // A fresh object each time, so everything reading `recency` sees the change.
    recency = on ? { ...settings } : null
  }

  function update(change: Partial<Settings>) {
    settings = { ...settings, ...change }
    if (enabled) recency = { ...settings }
  }
</script>

<section>
  <div class="sentence">
    <label>
      <input type="checkbox" checked={enabled} {disabled} onchange={(e) => setEnabled(e.currentTarget.checked)} />
      Prefer songs added in the last
    </label>
    <select
      class="field"
      aria-label="Period"
      disabled={disabled || !enabled}
      value={String(settings.halfLifeDays)}
      onchange={(e) => update({ halfLifeDays: Number(e.currentTarget.value) as Settings['halfLifeDays'] })}
    >
      {#each RECENCY_PERIODS as period (period.value)}
        <option value={String(period.value)}>{period.label}</option>
      {/each}
    </select>
    <select
      class="field"
      aria-label="Strength"
      disabled={disabled || !enabled}
      value={String(settings.strength)}
      onchange={(e) => update({ strength: Number(e.currentTarget.value) as Settings['strength'] })}
    >
      {#each RECENCY_STRENGTHS as strength (strength.value)}
        <option value={String(strength.value)}>{strength.label}</option>
      {/each}
    </select>
  </div>

  {#if recency}
    {#if noEffect}
      <p class="hint warning">All these tracks were added around the same time, so this has no effect.</p>
    {:else}
      <p class="hint">
        The newest songs (added {new Date(newest).toLocaleDateString()}) are ×{recency.strength} as likely as old
        ones, and the extra weight halves for every {periodLabel} a song was added before them. Boosted artists aren't
        held back by their age.
      </p>
    {/if}
  {/if}
</section>

<style>
  section {
    margin-top: 1.5rem;
  }

  .sentence {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  input[type='checkbox'] {
    width: 1.1rem;
    height: 1.1rem;
    margin: 0;
  }

  select {
    font-weight: normal;
  }

  select:disabled {
    opacity: 0.5;
  }

  p {
    margin: 0.25rem 0 0;
  }

  .warning {
    color: #f5c451;
  }
</style>
