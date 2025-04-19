import type { Handle, RequestEvent } from '@sveltejs/kit';
// import { paraglideMiddleware } from '$lib/paraglide/server'; // Commented out Paraglide
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { TELEGRAM_API_ID, TELEGRAM_API_HASH } from '$env/static/private';

/* // Commented out Paraglide middleware setup
const handleParaglide = paraglideMiddleware({ 
	languageInUrl: false, 
	exclude: ['/api', '/healthcheck', '/sitemap.xml']
});
*/

// Telegram Auth Check Logic
const apiId = parseInt(TELEGRAM_API_ID || '', 10);
const apiHash = TELEGRAM_API_HASH || '';
const SESSION_COOKIE_NAME = 'telegram_session';

async function checkTelegramAuth(event: RequestEvent): Promise<boolean> {
	event.locals = event.locals || {}; 
	const sessionCookieValue = event.cookies.get(SESSION_COOKIE_NAME);
	let isAuthorized = false;

	if (sessionCookieValue && apiId && apiHash) {
		console.log('[Hook] Checking Telegram auth...');
		const tempSession = new StringSession(sessionCookieValue);
		const tempClient = new TelegramClient(tempSession, apiId, apiHash, {
			 connectionRetries: 1,
		});
		try {
			await tempClient.connect();
			if (tempClient.connected) {
				isAuthorized = await tempClient.isUserAuthorized();
				console.log(`[Hook] Auth result: ${isAuthorized}`);
				await tempClient.disconnect();
			} else {
				 console.log('[Hook] Temp client connect failed.');
			}
		} catch (err: any) {
			console.error('[Hook] Error checking auth:', err.message);
			if (err.code === 401 || err.message?.includes('AUTH_KEY')) {
				 console.log('[Hook] Invalid auth key, clearing cookie.');
				 event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
			}
		}
	} else {
		 if (!sessionCookieValue) {
			 console.log('[Hook] No session cookie found.');
		 }
		 if (!apiId || !apiHash) {
			 console.log('[Hook] API ID or Hash not configured.');
		 }
	}
	
	event.locals.isTelegramAuthorized = isAuthorized;
	return isAuthorized;
}

// Simplified Handle function without Paraglide
export const handle: Handle = async ({ event, resolve }) => {
	// Perform Telegram Auth Check
	await checkTelegramAuth(event);

	// Continue request processing
	console.log('[Hook] Resolving request after auth check.'); // Added log
	const response = await resolve(event);

	return response;
};
