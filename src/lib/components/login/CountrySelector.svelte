<script lang="ts">
	import { ChevronDown } from 'svelte-lucide';
	// import { createEventDispatcher } from 'svelte'; // Removed
	import * as m from '$lib/paraglide/messages.js';

	type Country = {
		code: string;
		name: string; // Name will be fetched from messages
		prefix: string;
	};

	// Define codes and prefixes, names will come from messages
	const countriesData: Omit<Country, 'name'>[] = [
		{ code: 'RU', prefix: '+7' },
		{ code: 'AZ', prefix: '+994' },
		{ code: 'US', prefix: '+1' },
		{ code: 'GB', prefix: '+44' },
		{ code: 'DE', prefix: '+49' },
		// TODO: Add more countries (ensure corresponding message keys exist)
	];

	// Function to get translated country name
	function getCountryName(code: string): string {
		const key = `country_${code.toLowerCase()}` as keyof typeof m;
		if (key in m && typeof m[key] === 'function') {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return (m[key] as any)();
		}
		return code; // Fallback to code if message doesn't exist
	}

	// Map data to include translated names
	const countries: Country[] = countriesData.map(c => ({
		...c,
		name: getCountryName(c.code)
	}));

	let {
        value = $bindable('AZ'),
        onCountryChange = (detail: { code: string; prefix: string }) => {}
    } = $props<{ 
        value?: string;
        onCountryChange?: (detail: { code: string; prefix: string }) => void;
     }>(); // Default to AZ

	// const dispatch = createEventDispatcher<{ countryChange: { code: string; prefix: string } }>(); // Removed

	function handleChange(event: Event) {
		const selectedCode = (event.target as HTMLSelectElement).value;
		const selectedCountry = countries.find((c) => c.code === selectedCode);
		if (selectedCountry) {
			value = selectedCode; // Update the bound prop
			// dispatch('countryChange', { code: selectedCountry.code, prefix: selectedCountry.prefix }); // Replaced
            onCountryChange({ code: selectedCountry.code, prefix: selectedCountry.prefix });
		}
	}

	// Dispatch initial value on mount
	$effect(() => {
        const initialCountry = countries.find((c) => c.code === value);
		if (initialCountry) {
            onCountryChange({ code: initialCountry.code, prefix: initialCountry.prefix });
		}
	});
</script>

<div class="w-full">
	<label class="block text-xs text-gray-400 mb-1" for="country">{m.login_label_country()}</label>
	<div class="relative">
		<select
			id="country"
			value={value}
			onchange={handleChange}
			class="w-full appearance-none rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
		>
			{#each countries as country (country.code)}
				<option value={country.code}>{country.name}</option>
			{/each}
		</select>
		<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
			<ChevronDown class="h-4 w-4" />
		</div>
	</div>
</div>