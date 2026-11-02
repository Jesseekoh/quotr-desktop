import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

// The (app) layout sends first-time users on to onboarding.
export const load = () => redirect(307, resolve('/dashboard'));
