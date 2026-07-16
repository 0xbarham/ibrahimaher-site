// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Pages are rendered on demand from D1 so admin edits go live without a rebuild.
// Routes that never touch the database opt back into prerendering individually.
export default defineConfig({
  site: 'https://ibrahimaher.com',
  output: 'server',
  adapter: cloudflare({
    // 'compile' transforms at build time and needs no provisioned Images binding.
    imageService: 'compile',
  }),
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/admin'),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
});
