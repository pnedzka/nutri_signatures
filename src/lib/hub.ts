/** The Nutri Partners app hub: the logo and „Wszystkie aplikacje” in the header lead back there. Override with VITE_HUB_URL. */
export const HUB_URL: string = ((import.meta.env.VITE_HUB_URL as string | undefined) || 'https://nutripartners.vercel.app').replace(/\/+$/, '');
