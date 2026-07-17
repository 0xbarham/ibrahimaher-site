/**
 * Absolute-URL helper.
 *
 * Extracted from Base.astro, which held the only correct copy of this logic. The
 * D1 content columns are why it has to exist at all: `canonical_url` and
 * `og_image` are stored ABSOLUTE ("https://ibrahimaher.com/blog/foo"), while the
 * defaults used in the same code paths are relative ("/assets/og-image.png"). A
 * bare `${siteUrl}${value}` is therefore correct for one and wrong for the other.
 *
 * It was wrong: all 10 posts shipped
 *   "@id":"https://ibrahimaher.comhttps://ibrahimaher.com/blog/..."
 * in BlogPosting.mainEntityOfPage, BreadcrumbList.item and image, because
 * blog/[slug].astro concatenated directly. <link rel=canonical>, og:url and
 * og:image were correct ONLY because they route through Base's copy — so the fix
 * is to give every caller one copy, not to patch each concat site.
 *
 * An already-absolute URL passes through untouched, which is what makes this safe
 * to apply to an admin-supplied field of unknown shape.
 */
export const makeAbs =
  (siteUrl: string) =>
  (path: string): string =>
    /^https?:\/\//.test(path) ? path : `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`;
