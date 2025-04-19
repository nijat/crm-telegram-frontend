import { json } from '@sveltejs/kit';
// Import the singleton instance directly
import { telegramService } from '$lib/telegram.service';
import type { RequestEvent, RequestHandler } from './$types.js';

const SESSION_COOKIE_NAME = 'telegram_session'; // Keep cookie name for setting it

export const POST: RequestHandler = async (event: RequestEvent) => {
  // No need to create instance, use singleton
  const { request, cookies } = event;
  try {
    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return json({ error: 'Password is required and must be a string' }, { status: 400 });
    }

    console.log(`[API Submit Password] Calling providePassword...`);
    // Use the singleton instance
    const result = await telegramService.providePassword(password);
    console.log(`[API Submit Password] Result:`, result);

    if (result.status === 'connected') {
        const newSessionString = telegramService.getSessionString(); // Get session from singleton
        if (newSessionString) {
             console.log('[API Submit Password] Setting session cookie.');
             cookies.set(SESSION_COOKIE_NAME, newSessionString, {
                 path: '/',
                 httpOnly: true,
                 secure: process.env.NODE_ENV === 'production',
                 maxAge: 60 * 60 * 24 * 30, // 30 days
                 sameSite: 'lax'
             });
        } else {
            console.warn('[API Submit Password] Login successful but no session string obtained.');
            cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
        }
    } else if (result.status === 'error') {
        const statusCode = result.message?.toLowerCase().includes('invalid password') ? 400 : 500;
        return json({ error: result.message || 'Failed to process password' }, { status: statusCode });
    }

    // Return status ('connected')
    return json({ status: result.status }, { status: 200 }); 

  } catch (error: any) {
    console.error('[API /api/telegram/submit-password] Unexpected Error:', error);
    return json({ error: 'Failed to process password', details: error.message || 'Unknown server error' }, { status: 500 });
  }
}; 