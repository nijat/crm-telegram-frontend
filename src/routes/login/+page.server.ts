import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals }) => {
    if (locals.isTelegramAuthorized) {
        console.log('[Load /login] User is authorized via locals, redirecting...');
        throw redirect(303, '/');
    }

    console.log('[Load /login] User is not authorized, rendering login page.');
    return {};
}; 