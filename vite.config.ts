import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The Supabase integration on Vercel names the public variables NEXT_PUBLIC_SUPABASE_*.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
})
