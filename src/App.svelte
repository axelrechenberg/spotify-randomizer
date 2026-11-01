<script lang="ts">
  import { onMount } from 'svelte'
  import { handleRedirect, isLoggedIn, login, logout } from './lib/auth'
  import Randomizer from './lib/Randomizer.svelte'
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
    <p class="muted">
      Logged in as <strong>{user.display_name ?? user.id}</strong>
      <button class="link logout" onclick={handleLogout}>Log out</button>
    </p>
    <Randomizer {user} />
  {:else}
    <p>Shuffle a playlist once, then play it in order.</p>
    <button class="primary" onclick={login}>Log in with Spotify</button>
  {/if}
</main>

<style>
  main {
    max-width: 32rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .logout {
    margin-left: 0.5rem;
  }
</style>
