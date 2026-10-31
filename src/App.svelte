<script lang="ts">
  import { onMount } from 'svelte'
  import { handleRedirect, isLoggedIn, login, logout } from './lib/auth'
  import { getCurrentUser, type User } from './lib/spotify'

  let user = $state<User | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  onMount(async () => {
    try {
      await handleRedirect()
      if (isLoggedIn()) user = await getCurrentUser()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      loading = false
    }
  })

  function handleLogout() {
    logout()
    user = null
  }
</script>

<main>
  <h1>Spotify Randomizer</h1>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if loading}
    <p>Loading…</p>
  {:else if user}
    <p>Logged in as <strong>{user.display_name ?? user.id}</strong>.</p>
    <button onclick={handleLogout}>Log out</button>
  {:else}
    <p>Shuffle a playlist once, then play it in order.</p>
    <button onclick={login}>Log in with Spotify</button>
  {/if}
</main>

<style>
  main {
    max-width: 32rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  button {
    font: inherit;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 999px;
    background: #1ed760;
    color: #000;
    cursor: pointer;
  }

  .error {
    color: #ff6b6b;
  }
</style>
