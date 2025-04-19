<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	let { value = $bindable(''), placeholder = '' } = $props<{ value?: string; placeholder?: string }>();
</script>

<div class="w-full">
	<label class="block text-xs text-blue-500 mb-1" for="phone">{m.login_label_phone()}</label>
	<input
		id="phone"
		type="tel"
		bind:value
        placeholder={placeholder}
		class="w-full rounded-md border border-blue-500 bg-transparent px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
	/>
</div> 