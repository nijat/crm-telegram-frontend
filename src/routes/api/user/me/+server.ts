import { json, type RequestHandler } from '@sveltejs/kit';
import { telegramService } from '$lib/telegram.service.js';

const SESSION_COOKIE_NAME = 'telegram_session'; // Ensure this matches the name used in login/auth hooks

// GET /api/user/me
export const GET: RequestHandler = async ({ cookies }) => {
    console.log('[API /api/user/me] Received request.');

    const session = cookies.get(SESSION_COOKIE_NAME);
    if (!session) {
        console.log('[API /api/user/me] No session cookie found.');
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Even with a cookie, ensure the service is connected using this session
    // connectAndCheck will try to connect using savedSessionInMemory if not connected
    // It's crucial that savedSessionInMemory is correctly loaded/validated by hooks/service init
    const isConnected = await telegramService.connectAndCheck();

    if (!isConnected) {
        console.log('[API /api/user/me] Service not connected, even with cookie. Potential session mismatch or expiry.');
        // Clear the likely invalid cookie
        cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
        return json({ error: 'Authentication required or session expired' }, { status: 401 });
    }

    // Now fetch user info
    try {
        const userInfo = await telegramService.getMe();

        if (!userInfo) {
            console.log('[API /api/user/me] Failed to get user info from service.');
            return json({ error: 'Failed to retrieve user information' }, { status: 500 });
        }

        console.log(`[API /api/user/me] Returning user info for ${userInfo.firstName}`);
        // Selectively return fields to avoid exposing too much data
        const safeUserInfo = {
            id: userInfo.id,
            firstName: userInfo.firstName,
            lastName: userInfo.lastName,
            username: userInfo.username,
            phone: userInfo.phone,
            isBot: userInfo.bot,
            // Add other fields as needed, e.g., profile picture ID
        };

        return json(safeUserInfo, { status: 200 });

    } catch (error: any) {
        console.error('[API /api/user/me] Error fetching user info:', error);
        return json({ error: 'Internal server error', details: error.message || 'Unknown error' }, { status: 500 });
    }
}; 