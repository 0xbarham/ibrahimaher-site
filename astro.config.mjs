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
  // `/blog/index.html` — the one legacy .html URL src/middleware.ts cannot answer,
  // so it is answered as a ROUTE, the only layer that runs early enough.
  //
  // Astro picks the route from the RAW pathname, then normalises that pathname
  // WITHOUT re-matching (astro 7.1.0, core/app/fetch-state.js):
  //
  //   if (routeData.type === 'page' && !routeHasHtmlExtension(routeData))
  //     this.pathname = this.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  //
  // /blog/ is the only directory with both index.astro and [slug].astro, so
  // `/blog/index.html` matches /blog/[slug] (`^\/blog\/([^/]+?)\/?$`) and is THEN
  // rewritten to `/blog/`, which that pattern does not match. getParams() returns
  // {} and stringifyParams() throws `TypeError: Missing parameter: slug`. That
  // throw is unreachable from middleware: AstroMiddleware.handle() awaits
  // getProps() BEFORE it runs the user chain, so onRequest never sees the request.
  //
  // Only this exact string breaks. `.replace(/\.html$/, '')` keeps a segment, so
  // /blog/foo.html -> /blog/foo still matches [slug]; `/index.html` deletes the
  // segment entirely. The /index\.html$/ regex is case-sensitive, which is why
  // /blog/Index.html already 301s via the middleware.
  //
  // A redirect route outranks /blog/[slug] (static segments sort first) and is
  // exempt from the rewrite twice over — type 'redirect' not 'page', and a literal
  // '.html' in its own definition — and getProps() returns early for redirects.
  //
  // Two consequences, both accepted:
  //  - Redirect routes short-circuit BEFORE middleware, so this single 301 is the
  //    one response without the security headers addSecurityHeaders() puts on
  //    everything else. It is strictly better than the 500 it replaces, and /blog/
  //    itself still carries them.
  //  - The adapter also emits these rules into dist/client/_redirects. That file is
  //    generated in Workers-valid syntax (relative destination, bare 301), unlike
  //    the hand-written Pages-only one that was removed — see wrangler.jsonc. It is
  //    belt-and-braces only: verified by emptying it, the Worker route still 301s.
  redirects: {
    '/blog/index.html': { status: 301, destination: '/blog/' },
  },
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
