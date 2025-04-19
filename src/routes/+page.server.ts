import type { Load } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

// Define a type for the expected user data structure
// (Should match the structure returned by /api/user/me)
type UserInfo = {
    id: number;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    phone: string | null;
    isBot: boolean;
    // Add other fields if needed
} | null;

export const load: PageServerLoad = async ({ fetch, depends }) => {
    console.log('Executing load function for /+page.server.ts');
    // Ensure this load function re-runs when dependency state changes, like login/logout
    depends('app:user'); 

    try {
        const response = await fetch('/api/user/me');

        if (response.ok) {
            const user: UserInfo = await response.json();
            console.log('User data fetched successfully in load:', user?.firstName);
            return { user };
        } else if (response.status === 401) {
            console.log('User not authenticated (401) in load function.');
            // Not authenticated, return null user
            return { user: null };
        } else {
            // Handle other potential errors (500, etc.)
            console.error(`Error fetching user data: ${response.status} ${response.statusText}`);
            const errorBody = await response.text(); // Read error body for more details
            console.error('Error body:', errorBody);
            return { user: null, error: `Failed to load user data (status ${response.status})` };
        }
    } catch (error: any) {
        console.error('Network or other error in load function:', error);
        return { user: null, error: 'Could not connect to API to fetch user data.' };
    }
}; 