import { json } from '@sveltejs/kit';
// Import the singleton instance directly
import { telegramService } from '$lib/telegram.service';
import type { RequestEvent, RequestHandler } from './$types.js';

const SESSION_COOKIE_NAME = 'telegram_session';

export const POST: RequestHandler = async (event: RequestEvent) => {
  // No need to create instance, use singleton
  const { request, cookies } = event;
  try {
    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return json({ error: 'Code is required and must be a string' }, { status: 400 });
    }

    console.log(`[API Submit Code] Calling provideCode...`);
    // Use the singleton instance
    const result = await telegramService.provideCode(code);
    console.log(`[API Submit Code] Result:`, result);

    if (result.status === 'connected') {
        const newSessionString = telegramService.getSessionString(); // Get session from singleton
        if (newSessionString) {
             console.log('[API Submit Code] Setting session cookie.');
             cookies.set(SESSION_COOKIE_NAME, newSessionString, {
                 path: '/',
                 httpOnly: true,
                 secure: process.env.NODE_ENV === 'production',
                 maxAge: 60 * 60 * 24 * 30, // 30 days
                 sameSite: 'lax'
             });
        } else {
            console.warn('[API Submit Code] Login successful but no session string obtained.');
             cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
        }
    } else if (result.status === 'error') {
        const statusCode = result.message?.toLowerCase().includes('invalid code') ? 400 : 500;
        return json({ error: result.message || 'Failed to process code' }, { status: statusCode });
    }

    // Return status ('connected' or 'password_required')
    return json({ status: result.status }, { status: 200 });

  } catch (error: any) {
    console.error('[API /api/telegram/submit-code] Unexpected Error:', error);
    return json({ error: 'Failed to process code', details: error.message || 'Unknown server error' }, { status: 500 });
  }
}; 