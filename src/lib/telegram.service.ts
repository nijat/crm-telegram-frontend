import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
// import { input } from '@inquirer/prompts'; // Not needed for backend service
import { TELEGRAM_API_ID, TELEGRAM_API_HASH } from '$env/static/private';
// import { sleep } from 'telegram/Helpers'; // Removed for now
// Errors are often checked by code or message, not specific imported classes
// import { SessionPasswordNeededError, PhoneCodeInvalidError, FloodWaitError } from 'telegram/errors';
// Need password helpers for SRP calculation
// import { getSRPParams } from 'telegram/Password'; // Removed - Not needed with client.start approach

// These are now module-level constants again
const apiId = parseInt(TELEGRAM_API_ID || '', 10);
const apiHash = TELEGRAM_API_HASH || '';

if (!apiId || !apiHash) {
  throw new Error('PRIVATE_TELEGRAM_API_ID and PRIVATE_TELEGRAM_API_HASH environment variables must be set.');
}

// Module-level variable to store the session string
let savedSessionInMemory: string = '';

type Resolver<T> = (value: T | PromiseLike<T>) => void;

// Reintroduce Singleton Pattern
export class TelegramService {
  private static instance: TelegramService | null = null;
  public client: TelegramClient;
  private isConnected: boolean = false;

  // State for the login process
  private isLoginInProgress: boolean = false;
  private needsCode: boolean = false;
  private needsPassword: boolean = false;
  private phoneCodeResolver: Resolver<string> | null = null;
  private passwordResolver: Resolver<string> | null = null;
  private loginPromise: Promise<void> | null = null;

  // NEW: Promises to signal readiness for code/password
  private codeReadyPromise: Promise<void> | null = null;
  private codeReadyResolver: Resolver<void> | null = null;
  private passwordReadyPromise: Promise<void> | null = null;
  private passwordReadyResolver: Resolver<void> | null = null;

  // Private constructor for singleton
  private constructor() {
    const session = new StringSession(savedSessionInMemory || '');
    this.client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });
    console.log('TelegramService Singleton instance created.');
    this.resetLoginProcessState(); // Ensure clean state
    this.connectAndCheck().catch(err => console.warn("Initial connection check failed:", err.message));
  }

  // Static method to get the singleton instance
  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  // Checks connection status, attempts connection if needed (without login flow)
  public async connectAndCheck(): Promise<boolean> {
    if (this.isConnected && this.client.connected) {
      console.log('[connectAndCheck] Already connected and marked as connected.');
      return true;
    }
    // If marked as connected but client isn't, reset state
    if (this.isConnected && !this.client.connected) {
      console.log('[connectAndCheck] Marked connected, but client is not. Resetting state.');
      this.isConnected = false;
      savedSessionInMemory = ''; // Session likely invalid
      this.client.session = new StringSession(''); // Use new empty session
    }

    // If we have a session string, try connecting with it directly
    if (savedSessionInMemory) {
      console.log('[connectAndCheck] Attempting connection with existing session...');
      try {
        // Use the existing client instance which was initialized with the session
        if (!this.client.connected) { // Avoid redundant connect calls
          await this.client.connect();
        }
        this.isConnected = await this.client.checkAuthorization() != null;
        if (this.isConnected) {
          console.log('[connectAndCheck] Connection successful with saved session.');
        } else {
          console.log('[connectAndCheck] Session invalid. Clearing.');
          savedSessionInMemory = ''; // Clear invalid session
          await this.client.disconnect(); // Disconnect if auth failed
          this.client.session = new StringSession(''); // Reset session on client
        }
      } catch (error: any) {
        console.error('[connectAndCheck] Error connecting with session:', error.message);
        this.isConnected = false;
        savedSessionInMemory = ''; // Clear potentially corrupt session
        this.client.session = new StringSession(''); // Reset session on client
        // Don't disconnect if connect itself failed, might be network issue
        if (this.client.connected) await this.client.disconnect();
      }
    } else {
      console.log('[connectAndCheck] No saved session.');
      this.isConnected = false;
    }
    console.log(`[connectAndCheck] Connection status: ${this.isConnected}`);
    return this.isConnected;
  }

  // NEW: Method to get the current login state
  public getLoginStatus(): { isActive: boolean; needsCode: boolean; needsPassword: boolean } {
    return {
      isActive: this.isLoginInProgress,
      needsCode: this.needsCode,
      needsPassword: this.needsPassword,
    };
  }

  // Login method uses the singleton instance state
  public async login(phoneNumber: string): Promise<{ status: 'already_connected' | 'pending_confirmation' | 'error', message?: string }> {
    if (await this.connectAndCheck()) {
      console.log('User already connected.');
      return { status: 'already_connected' };
    }
    if (this.isLoginInProgress) return { status: 'error', message: 'Login already in progress.' };

    this.resetLoginProcessState();
    this.isLoginInProgress = true;
    let immediateError: Error | null = null;

    // Create readiness promises
    this.codeReadyPromise = new Promise<void>((resolve) => { this.codeReadyResolver = resolve; });
    this.passwordReadyPromise = new Promise<void>((resolve) => { this.passwordReadyResolver = resolve; });

    try {
      console.log(`Initiating client.start for ${phoneNumber}...`);

      // Use the singleton client instance
      this.loginPromise = this.client.start({
        phoneNumber: phoneNumber,
        phoneCode: async () => {
          console.log('>>> phoneCode callback running');
          this.needsCode = true;
          // Resolve the readiness promise *after* setting the resolver
          if (this.codeReadyResolver) this.codeReadyResolver();
          return new Promise<string>((resolve) => { this.phoneCodeResolver = resolve; });
        },
        password: async (hint) => {
          console.log('>>> password callback running');
          this.needsPassword = true;
          // Resolve the readiness promise *after* setting the resolver
          if (this.passwordReadyResolver) this.passwordReadyResolver();
          return new Promise<string>((resolve) => { this.passwordResolver = resolve; });
        },
        onError: (err) => {
          console.error('>>> onError callback running', err);
          // Capture the error to be thrown after start returns
          // This helps handle errors like PHONE_NUMBER_INVALID immediately
          immediateError = err;
          // Reset state if an immediate error occurs during setup
          this.resetLoginProcessState();
        },
      }).then(() => {
        console.log('>>> loginPromise resolved successfully.');
        // This .then() executes only when the entire login flow *completes* successfully
        // (i.e., after code/password if needed, or immediately if no auth needed)
        if (this.isLoginInProgress) { // Check if still relevant (not reset by error/disconnect)
          console.log('>>> Login completed successfully by client.start');
          this.handleSuccessfulLogin();
        }
      }).catch((err) => {
        console.error('>>> loginPromise rejected:', err);
        // This .catch() handles errors during the interactive part (e.g., invalid code/password)
        // or if the initial connection fails fundamentally after returning pending_confirmation
        if (this.isLoginInProgress) { // Check if still relevant
          this.resetLoginProcessState(); // Reset state on any error in the flow
        }
        // Note: We don't re-throw here, the error is handled by callers awaiting loginPromise elsewhere
      });

      // Brief pause to allow callbacks (like onError) to potentially run
      // This is a minor mitigation, the robust solution is status polling
      await new Promise(resolve => setTimeout(resolve, 100)); // Increased slightly

      // Check if onError was called immediately
      if (immediateError) {
        console.log('>>> Immediate error detected from onError callback.', immediateError.message);
        // State already reset in onError
        return { status: 'error', message: immediateError.message || 'Login failed during initiation' };
      }

      // If no immediate error, assume we are waiting for user action (code/password)
      // or the connection will succeed directly (handled by loginPromise.then)
      console.log('[login] Returning status: pending_confirmation');
      return { status: 'pending_confirmation' };

    } catch (err: any) {
      // This catch block handles errors *before* or during the client.start() call itself
      // (e.g., network issues before the promise is even set up)
      console.error('[login] Caught error during initial setup:', err);
      this.resetLoginProcessState(); // Reset state on setup failure
      return { status: 'error', message: err.message || 'Login failed during setup' };
    }
  }

  // provideCode uses singleton state
  public async provideCode(code: string): Promise<{ status: 'password_required' | 'connected' | 'error', message?: string }> {
    // Check primary conditions first
    if (!this.isLoginInProgress || !this.loginPromise) {
      return { status: 'error', message: 'Login process not active or promise missing.' };
    }
    // Specifically check if we are expecting a code
    if (!this.needsCode || !this.phoneCodeResolver) {
      // Add a check to see if password is required instead - maybe a race condition?
      if (this.needsPassword) {
        return { status: 'password_required', message: 'Password is required, not code.' };
      }
      return { status: 'error', message: 'Not awaiting phone code.' };
    }

    console.log('Providing phone code to resolver...');
    this.phoneCodeResolver(code);
    this.needsCode = false;       // We are no longer waiting for the code
    // Don't nullify phoneCodeResolver immediately, let loginPromise handle it? No, seems safe here.
    this.phoneCodeResolver = null;

    try {
      // Await the main login promise. This promise resolves/rejects based on the *entire* flow.
      await this.loginPromise;

      // If loginPromise resolved without error, check if password is now needed
      if (this.needsPassword) {
        console.log('Code provided, but now password is required.');
        return { status: 'password_required' };
      } else if (this.isConnected) {
        // Login completed successfully after code, and handleSuccessfulLogin was called by loginPromise.then
        console.log('Login completed successfully after code provided (via loginPromise).');
        return { status: 'connected' };
      } else {
        // Should not happen if loginPromise resolved and needsPassword is false
        console.warn('loginPromise resolved but state is inconsistent (not connected, no password needed)');
        this.resetLoginProcessState(); // Reset to safe state
        return { status: 'error', message: 'Internal state inconsistency after code submission.' };
      }
    } catch (err: any) {
      // loginPromise was rejected (e.g., invalid code, network error during finalization)
      console.error('Error after providing code (awaiting loginPromise):', err);
      // State should have been reset by loginPromise.catch
      let message = 'Failed after code submission';
      if (err instanceof Error) {
          message = err.message;
      } else if (typeof err === 'string') {
          message = err;
      } else {
           console.error("Caught non-Error object:", err);
           message = String(err); // Fallback
      }

      // Specific error check
      if (message.includes('PHONE_CODE_INVALID')) {
        // Reset needsCode so user might retry? Needs careful state handling.
        // For now, just return the error. Frontend needs logic to allow retry.
        this.resetLoginProcessState(); // Simplest: require full login retry
        return { status: 'error', message: 'Invalid phone code.' };
      }
      if (!this.isLoginInProgress) { // Check if state was already reset
        console.log("State already reset by loginPromise's catch handler.");
      } else {
        this.resetLoginProcessState(); // Ensure reset if catch handler didn't run somehow
      }
      return { status: 'error', message: message };
    }
  }

  // providePassword uses singleton state
  public async providePassword(password: string): Promise<{ status: 'connected' | 'error', message?: string }> {
    // Check primary conditions first
    if (!this.isLoginInProgress || !this.loginPromise) {
      return { status: 'error', message: 'Login process not active or promise missing.' };
    }
    // Specifically check if we are expecting a password
    if (!this.needsPassword || !this.passwordResolver) {
      // Add a check to see if code is required instead - maybe a race condition?
      if (this.needsCode) {
        return { status: 'error', message: 'Phone code is required, not password.' };
      }
      return { status: 'error', message: 'Not awaiting password.' };
    }

    console.log('Providing password to resolver...');
    this.passwordResolver(password);
    this.needsPassword = false;   // We are no longer waiting for the password
    // Don't nullify passwordResolver immediately? Safe here.
    this.passwordResolver = null;

    try {
      // Await the main login promise. It resolves/rejects based on the entire flow.
      await this.loginPromise;

      // If loginPromise resolved, login is complete and successful
      if (this.isConnected) {
        // handleSuccessfulLogin was called by loginPromise.then
        console.log('Login completed successfully after password provided (via loginPromise).');
        return { status: 'connected' };
      } else {
        // Should not happen if loginPromise resolved
        console.warn('loginPromise resolved but state is inconsistent (not connected)');
        this.resetLoginProcessState(); // Reset to safe state
        return { status: 'error', message: 'Internal state inconsistency after password submission.' };
      }

    } catch (err: any) {
      // loginPromise was rejected (e.g., invalid password, network error)
      console.error('Error after providing password (awaiting loginPromise):', err);
      // State should have been reset by loginPromise.catch
      let message = 'Failed after password submission';
      if (err instanceof Error) {
          message = err.message;
      } else if (typeof err === 'string') {
          message = err;
      } else {
          console.error("Caught non-Error object:", err);
          message = String(err); // Fallback
      }

      // Specific error check
      if (message.includes('PASSWORD_HASH_INVALID') || message.includes('PASSWORD_REQUIRED')) { // GramJS might throw PASSWORD_REQUIRED if 2FA enabled but no password callback set up? Unlikely here.
        this.resetLoginProcessState(); // Require full login retry
        return { status: 'error', message: 'Invalid password.' };
      }
      if (!this.isLoginInProgress) { // Check if state was already reset
        console.log("State already reset by loginPromise's catch handler.");
      } else {
        this.resetLoginProcessState(); // Ensure reset
      }
      return { status: 'error', message: message };
    }
  }

  // Updates the session string managed by the singleton
  private handleSuccessfulLogin() {
    console.log("handleSuccessfulLogin called"); // Added log
    this.isConnected = true;
    this.isLoginInProgress = false;
    this.needsCode = false;
    this.needsPassword = false;
    // Clear resolvers and readiness promises
    this.phoneCodeResolver = null;
    this.passwordResolver = null;
    this.codeReadyPromise = null;
    this.codeReadyResolver = null;
    this.passwordReadyPromise = null;
    this.passwordReadyResolver = null;
    // loginPromise is implicitly handled as it resolves

    const sessionString = this.client.session.save() as any; // Cast for safety
    if (typeof sessionString === 'string' && sessionString.length > 0) {
      savedSessionInMemory = sessionString; // Update module-level session
      console.log('Sign in successful. New session string stored in memory.');
    } else {
      console.warn('Session string was not saved correctly after login.');
      savedSessionInMemory = ''; // Clear if save failed
    }
    // Don't nullify loginPromise here, let the awaiters handle the resolution/rejection
    // this.loginPromise = null; // Removed this line
  }

  // Method to get the current session string for cookie setting
  public getSessionString(): string {
    return savedSessionInMemory;
  }

  private resetLoginProcessState() {
    console.log("resetLoginProcessState called"); // Added log
    this.isLoginInProgress = false;
    this.needsCode = false;
    this.needsPassword = false;
    // Ensure resolvers are cleared if they exist (e.g., if reset called mid-callback somehow)
    if (this.phoneCodeResolver) {
      // Rejecting might be cleaner if something is awaiting the promise, but we don't expose it
      // this.phoneCodeResolver(''); // Or perhaps reject?
      this.phoneCodeResolver = null;
    }
    if (this.passwordResolver) {
      // this.passwordResolver(''); // Or reject?
      this.passwordResolver = null;
    }
    // loginPromise should ideally be rejected or resolved by its own flow or timeout
    // Forcing it null here can lead to unhandled promise errors if awaited elsewhere.
    // Let the catch/then handlers on loginPromise manage its lifecycle and the state reset.
    // this.loginPromise = null; // Removed this line

    // Reset readiness signals
    this.codeReadyPromise = null;
    this.codeReadyResolver = null;
    this.passwordReadyPromise = null;
    this.passwordReadyResolver = null;
  }

  // Disconnects the singleton client
  public async disconnect(): Promise<void> {
    console.log('Disconnecting singleton client instance.');
    const wasInProgress = this.isLoginInProgress;
    const loginPromiseToCancel = this.loginPromise; // Capture before resetting state

    this.resetLoginProcessState(); // Clear login state flags first
    this.isConnected = false;
    savedSessionInMemory = ''; // Clear stored session

    // Cancel any ongoing login attempt explicitly if possible
    if (wasInProgress && loginPromiseToCancel) {
      console.log('Attempting to cancel ongoing login process due to disconnect.');
      // GramJS doesn't have a direct 'cancel' for client.start.
      // Disconnecting *might* cause the loginPromise to reject, which is handled by its .catch
    }

    if (this.client && this.client.connected) {
      console.log('Client is connected, attempting disconnect...');
      try {
        // Disconnect directly
        await this.client.disconnect();
        console.log('Client disconnected successfully.');
      } catch (error) {
        console.error('Error during client disconnect:', error);
      }
    } else {
      console.log('Client was not connected or already disconnected.');
    }
    // Ensure session is cleared on the client object too
    this.client.session = new StringSession('');
    console.log('Client session cleared.');
  }

  public getIsConnected(): boolean {
    // More reliable check: use client's status if possible, fallback to internal flag
    // return this.client?.connected && this.isConnected; // This might be too strict if client disconnects temporarily
    return this.isConnected; // Rely on our state management logic
  }

  // NEW: Method to get current user info
  public async getMe(): Promise<any | null> { // TODO: Define a proper User type
    if (!this.isConnected || !this.client || !this.client.connected) {
      console.log('[getMe] Not connected.');
      // Attempt to reconnect using session if possible
      if (!(await this.connectAndCheck())) {
         console.log('[getMe] Reconnect attempt failed.');
         return null; // Still not connected
      }
       console.log('[getMe] Reconnect successful.');
    }

    try {
      console.log('[getMe] Fetching current user info...');
      const me = await this.client.getMe();
      console.log('[getMe] User info obtained:', me?.firstName);
      // You might want to return a subset of the user object
      // e.g., { id: me.id, firstName: me.firstName, lastName: me.lastName, username: me.username, phone: me.phone }
      return me;
    } catch (error) {
      console.error('[getMe] Error fetching user info:', error);
      return null;
    }
  }
}

// Export the singleton instance directly
export const telegramService = TelegramService.getInstance();

// Example usage (optional, could be in your API route or server logic)
/*
async function main() {
  const phone = await input.text('Please enter your phone number: ');
  try {
    await telegramService.connect(phone); // Obsolete? Use login()

    if (telegramService.getIsConnected()) {
      console.log('Successfully connected!');
      // You can add further interactions here
      // e.g., const chats = await telegramService.client.getDialogs({});
      // console.log(chats);
    }
  } catch (error) {
    console.error('Login process failed:', error);
  } finally {
    // Optional: disconnect when done, or keep the connection alive
    // await telegramService.disconnect();
  }
}

// main(); // Uncomment to run example usage directly
*/ 