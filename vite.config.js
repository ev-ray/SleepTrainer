import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// base './' keeps every URL relative, so the build works on GitHub Pages
// under /<repo>/ as well as on a custom domain.
export default defineConfig({
  base: './',
  plugins: [preact()],
})
