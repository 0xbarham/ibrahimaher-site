// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';

// Pages are rendered on demand from D1 so admin edits go live without a rebuild.
// Routes that never touch the database opt back into prerendering individually.
export default defineConfig({
  site: 'https://ibrahimaher.com',
  output: 'server',
  adapter: cloudflare({
    // 'compile' transforms at build time and needs no provisioned Images binding.
    imageService: 'compile',
  }),
  // @astrojs/sitemap is deliberately NOT used: it only enumerates prerendered
  // routes, and every route here is SSR from D1, so it would emit an almost
  // empty sitemap at the wrong path. src/pages/sitemap.xml.ts builds it from the
  // database instead, and keeps the /sitemap.xml URL that robots.txt and Search
  // Console already point at.
  integrations: [mdx()],
  build: {
    inlineStylesheets: 'auto',
  },
});
