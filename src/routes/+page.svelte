<script lang="ts">
	import type { PageData } from './$types.js'; // Import PageData type

	// Get the data loaded by +page.server.ts
	export let data: PageData;

	// Reactive declaration to easily access the user object
	$: user = data.user;
	$: error = data.error;

    // TODO: Add logic for handling login/logout/redirects if user is null
    // TODO: Add components for displaying chats, contacts, etc.
</script>

<svelte:head>
	<title>Telegram CRM - Dashboard</title>
	<meta name="description" content="Telegram CRM Main Dashboard" />
</svelte:head>

<section class="p-4 md:p-8">
	<h1 class="text-2xl font-semibold mb-4">
		{#if user}
			Welcome, {user.firstName || 'User'}!
		{:else if error}
			Error Loading Data
        {:else}
            <!-- Could show a loading state or redirect logic here -->
			Dashboard
		{/if}
	</h1>

	{#if error}
		<div class="text-red-500 bg-red-100 border border-red-400 p-3 rounded mb-4">
			<p>Could not load user information:</p>
			<p>{error}</p>
			<!-- Suggest logout or retry? -->
		</div>
	{/if}

	{#if user}
		<p class="mb-2">You are logged in.</p>
        <p class="text-sm text-gray-600">Username: {user.username || 'N/A'}</p>
        <p class="text-sm text-gray-600 mb-4">Phone: {user.phone || 'N/A'}</p>

		<!-- Placeholder for main CRM content -->
		<div class="bg-gray-100 p-6 rounded-lg shadow">
			<h2 class="text-xl mb-4">CRM Content Area</h2>
			<p>Your chats and contacts will appear here.</p>
			<!-- TODO: Implement chat list, contact list, message view components -->
		</div>
	{:else if !error}
        <!-- If user is null and there's no error, it might mean they are not logged in -->
        <!-- Add redirect logic or a login prompt here -->
        <p>Loading user data or user not logged in.</p> 
    {/if}

	<!-- You might want a logout button somewhere -->
	<!-- Example: <a href="/logout" class="text-blue-500 hover:underline mt-4 inline-block">Logout</a> -->

</section>
