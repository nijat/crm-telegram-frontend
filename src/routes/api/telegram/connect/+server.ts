import { json } from '@sveltejs/kit';
// Import the singleton instance directly
import { telegramService } from '$lib/telegram.service';
import type { RequestEvent, RequestHandler } from './$types.js';

// const SESSION_COOKIE_NAME = 'telegram_session'; // Cookie name not needed here

export const POST: RequestHandler = async (event: RequestEvent) => {
  // No need to read cookies or create instance here
  const { request } = event;
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return json({ error: 'Phone number is required and must be a string' }, { status: 400 });
    }

    console.log(`[API Connect] Calling login for ${phoneNumber}...`);
    // Use the singleton instance
    const result = await telegramService.login(phoneNumber);
    console.log(`[API Connect] Result:`, result);

    if (result.status === 'error') {
       const statusCode = result.message?.includes('initialize client') ? 503 : 500;
       return json({ error: result.message || 'Login initiation failed' }, { status: statusCode });
    }
    
    // Return status (pending_confirmation or already_connected)
    return json({ status: result.status }, { status: 200 });

  } catch (error: any) {
    console.error('[API /api/telegram/connect] Unexpected Error:', error);
    return json({ error: 'Failed to initiate connection', details: error.message || 'Unknown server error' }, { status: 500 });
  }
}; 