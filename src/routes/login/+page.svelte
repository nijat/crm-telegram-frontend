<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import CountrySelector from '$lib/components/login/CountrySelector.svelte';
	import LoginDescription from '$lib/components/login/LoginDescription.svelte';
	import LoginHeader from '$lib/components/login/LoginHeader.svelte';
	import NextButton from '$lib/components/login/NextButton.svelte';
	import PhoneNumberInput from '$lib/components/login/PhoneNumberInput.svelte';
	import QrCodeLink from '$lib/components/login/QrCodeLink.svelte';

	let selectedCountryCode = 'AZ'; // Store only the code now
	let phoneNumber = ''; // Initialize empty, will be set by event

	function handleNext() {
		console.log('Next clicked:', { countryCode: selectedCountryCode, phoneNumber });
		// TODO: Call API from src/lib/api/auth.ts
	}

	function handleCountryChange(detail: { code: string; prefix: string }) {
        const { code, prefix } = detail; // Directly use the detail object
        selectedCountryCode = code;
        // Only update the prefix part, keep existing number part if any
        const currentNumberPart = phoneNumber.split(' ').slice(1).join(' ');
        phoneNumber = prefix + ' ' + currentNumberPart;
	}

</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4 py-12">
	<div class="w-full max-w-xs space-y-8">
		<LoginHeader />
		<LoginDescription />

		<div class="space-y-4">
			<CountrySelector value={selectedCountryCode} onCountryChange={handleCountryChange} />
			<PhoneNumberInput bind:value={phoneNumber} placeholder={m.login_placeholder_phone()} />
		</div>

		<div class="space-y-5">
			<NextButton onclick={handleNext} />
			<div class="text-center">
				<QrCodeLink />
			</div>
		</div>
	</div>
</div>