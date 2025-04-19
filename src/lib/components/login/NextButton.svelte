<script lang="ts">
    import * as m from '$lib/paraglide/messages.js';
    let { onclick = () => {} } = $props<{ onclick?: () => void }>();
</script>

<button
    type="button"
    onclick={onclick}
    class="w-full rounded-md bg-blue-500 py-2.5 text-sm font-medium text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
>
    {m.login_button_next()}
</button> 