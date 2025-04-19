<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import CountrySelector from '$lib/components/login/CountrySelector.svelte';
	import LoginDescription from '$lib/components/login/LoginDescription.svelte';
	import LoginHeader from '$lib/components/login/LoginHeader.svelte';
	import NextButton from '$lib/components/login/NextButton.svelte';
	import PhoneNumberInput from '$lib/components/login/PhoneNumberInput.svelte';
	import QrCodeLink from '$lib/components/login/QrCodeLink.svelte';
	// import { goto } from '$app/navigation'; // Keep if needed for redirects later

	type LoginStep = 'phone' | 'code' | 'password' | 'connected' | 'error';

	let selectedCountryCode = 'AZ';
	let phoneNumber = ''; // User input including prefix
	let code = '';
	let password = '';
	let loginStep: LoginStep = 'phone';

	let isLoading = false;
	let errorMessage = '';
	let statusMessage = ''; // General status message
	let isButtonDisabled = false; // Keep the reactive calculation, might be useful elsewhere

	async function handleNext() {
		isLoading = true;
		errorMessage = '';
		let endpoint = '';
		let body = {};
		let loadingMessage = '';

		try {
			if (loginStep === 'phone') {
				if (!phoneNumber) throw new Error('Phone number is required.');
				endpoint = '/api/telegram/connect';
				body = { phoneNumber: phoneNumber.replace(/\s/g, '') };
				loadingMessage = 'Connecting...';
				loginStep = 'code';
			} else if (loginStep === 'code') {
				if (!code) throw new Error('Code is required.');
				endpoint = '/api/telegram/submit-code';
				body = { code };
				loadingMessage = 'Submitting code...';
				loginStep = 'password';
			} else if (loginStep === 'password') {
				if (!password) throw new Error('Password is required.');
				endpoint = '/api/telegram/submit-password';
				body = { password };
				loadingMessage = 'Submitting password...';
			} else {
				throw new Error('Invalid login step');
			}

			statusMessage = loadingMessage;

			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			const data = await response.json();

			console.log('[UI handleNext] Received API response status:', response.status);
			console.log('[UI handleNext] Received API response data:', JSON.stringify(data));

			if (!response.ok) {
				throw new Error(data.error || `Request failed`);
			}

			// Process successful response status
			if (data.status === 'pending_confirmation') {
				loginStep = 'code';
				statusMessage = 'Check Telegram for code/confirmation. Enter code below if received.';
			} else if (data.status === 'code_required') {
				loginStep = 'code';
				statusMessage = 'Code required. Please enter the code.';
			} else if (data.status === 'password_required') {
				loginStep = 'password';
				statusMessage = 'Please enter your two-factor authentication password.';
			} else if (data.status === 'connected' || data.status === 'already_connected') {
				loginStep = 'connected';
				statusMessage = 'Successfully connected! Redirecting...';
				await goto('/');
			} else {
				loginStep = 'error';
				statusMessage = '';
				errorMessage = `Received unexpected status: ${data.status}`;
			}

			console.log('[UI handleNext] loginStep set to:', loginStep);

		} catch (error: any) {
			console.error(`Error during step ${loginStep}:`, error);
			errorMessage = error.message || 'An unexpected error occurred.';
			statusMessage = '';
		} finally {
			isLoading = false;
		}
	}

	function handleCountryChange(event: CustomEvent<{ code: string; prefix: string }>) {
		const { code, prefix } = event.detail;
		selectedCountryCode = code;
		const currentNumberPart = phoneNumber.split(' ').slice(1).join(' ');
		phoneNumber = prefix + ' ' + currentNumberPart.trim();
	}

	// Reactive variables for button state
	$: buttonText = loginStep === 'connected' ? 'Connected' : 'Next';
	$: isButtonDisabled = isLoading || loginStep === 'connected';

</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4 py-12">
	<div class="w-full max-w-xs space-y-8">
		<LoginHeader />
		<LoginDescription />

		<div class="space-y-4">
			{#if loginStep === 'phone'}
				<CountrySelector value={selectedCountryCode} on:countryChange={handleCountryChange} />
				<PhoneNumberInput bind:value={phoneNumber} placeholder={m.login_placeholder_phone()} />
			{:else if loginStep === 'code'}
				<!-- DEBUG: Confirm rendering code block -->
				<!-- <p class="text-center text-xs text-green-300">Rendering Code Input Block</p> -->
				<div>
					<label for="code" class="block text-sm font-medium text-gray-300 mb-1">Verification Code</label>
					<input 
						type="text" 
						id="code" 
						bind:value={code} 
						autocomplete="one-time-code"
						inputmode="numeric"
						required 
						class="block w-full rounded-md border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
					/>
				</div>
			{:else if loginStep === 'password'}
				<div>
                    <label for="password" class="block text-sm font-medium text-gray-300 mb-1">Password (2FA)</label>
                    <input 
                        type="password" 
                        id="password" 
                        bind:value={password} 
                        required
                        class="block w-full rounded-md border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
			{/if}
		</div>

		<!-- Display Status/Error Messages -->
		{#if statusMessage && !isLoading}
			<p class="text-center text-sm text-blue-400">{statusMessage}</p>
		{/if}
		{#if errorMessage}
			<p class="text-center text-sm text-red-400">{errorMessage}</p>
		{/if}
		{#if isLoading && statusMessage} 
			<p class="text-center text-sm text-gray-400">{statusMessage}</p> 
		{/if}

		<div class="space-y-5">
			<NextButton 
				onclick={handleNext} 
			/> 
			{#if loginStep === 'phone'}
				<div class="text-center">
					<QrCodeLink />
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Removed the duplicate H1, form, status/error paragraphs, and style block -->