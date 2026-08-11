/**
 * Language support for the site chrome.
 *
 * The site is English-first and stays that way: `en` is the x-default and the
 * fallback for every prop, so a page that says nothing about language renders
 * byte-identically to how it did before Arabic existed.
 *
 * Arabic is here because the Iraqi market searches in Arabic. The English pages
 * already rank for `n8n developer Iraq`-shaped queries, but that is a narrow,
 * English-speaking slice of the country; the far larger Baghdad/Basra/Mosul
 * demand for AI automation and chatbots is searched in Arabic, where the site
 * previously had no surface at all.
 */

export type Lang = 'en' | 'ar';

export const LANGS: Lang[] = ['en', 'ar'];

export const DIR: Record<Lang, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

/**
 * hreflang values. The Arabic copy is Modern Standard Arabic, not dialect, so it
 * reads correctly anywhere in the region. It is still regionalised to `ar-IQ`
 * because what is Iraq-specific is the SUBSTANCE rather than the register: the
 * price context, the governorates served, and the local-versus-remote split.
 * Bare `ar` would invite Google to serve these pages across the whole
 * Arabic-speaking world, where a local competitor is the better answer.
 *
 * English stays unregionalised: the English pages genuinely do serve remote
 * clients worldwide, so `en` is honest and `en-IQ` would be needlessly narrow.
 */
export const HREFLANG: Record<Lang, string> = {
  en: 'en',
  ar: 'ar-IQ',
};

export const OG_LOCALE: Record<Lang, string> = {
  en: 'en_US',
  ar: 'ar_IQ',
};

/** Which language is the x-default — the page served when no locale matches. */
export const DEFAULT_LANG: Lang = 'en';

interface Chrome {
  /** Primary nav, in this language. */
  nav: { href: string; label: string }[];
  skipLink: string;
  primaryNavLabel: string;
  themeToggle: string;
  homeLabel: string;
  footerCredit: string;
  /** Label on the control that switches to the OTHER language. */
  switchTo: string;
  switchToHref: (path: string) => string;
}

/**
 * Nav hrefs differ per language, not just the labels: the Arabic nav must point
 * at the Arabic routes or every click would drop the reader back into English.
 * Arabic has no /ar/about yet, so its nav links the pages that do exist, and it
 * is capped at five because a sixth would wrap on a 375px phone. /ar/vibe-coder
 * gives up its slot to /ar/blog/ rather than the nav growing: the writing needs
 * a route in from every page or it is an orphan, whereas the vibe-coder page is
 * still one click away from the homepage service cards.
 */
export const CHROME: Record<Lang, Chrome> = {
  en: {
    nav: [
      { href: '/', label: 'Home' },
      { href: '/n8n-developer', label: 'Hire me' },
      { href: '/about', label: 'About' },
      { href: '/blog/', label: 'Writing' },
      { href: '/contact', label: 'Contact' },
    ],
    skipLink: 'Skip to content',
    primaryNavLabel: 'Primary',
    themeToggle: 'Switch between light and dark mode',
    homeLabel: 'home',
    footerCredit: 'Designed and built by',
    switchTo: 'العربية',
    switchToHref: (path) => toArabic(path),
  },
  ar: {
    nav: [
      /*
        Kept SHORT on purpose. The nav is flex with nowrap and no mobile
        collapse, so at 375px the five labels have to fit on one line each. The
        first drafts ("أتمتة الذكاء الاصطناعي", "برمجة بالذكاء الاصطناعي") were
        descriptive but wrapped to two lines inside ~80px boxes, which is the
        only place the Arabic pages actually broke on a phone. The English nav
        fits because its labels are one or two short words; Arabic has to earn
        the same brevity rather than inherit it.
      */
      { href: '/ar/', label: 'الرئيسية' },
      { href: '/ar/n8n-developer', label: 'الأتمتة' },
      { href: '/ar/ai-automation-developer', label: 'ذكاء اصطناعي' },
      { href: '/ar/blog/', label: 'مقالات' },
      { href: '/ar/contact', label: 'تواصل' },
    ],
    skipLink: 'تخطَّ إلى المحتوى',
    primaryNavLabel: 'التنقل الرئيسي',
    themeToggle: 'التبديل بين الوضع الفاتح والداكن',
    homeLabel: 'الصفحة الرئيسية',
    footerCredit: 'تصميم وتنفيذ',
    switchTo: 'English',
    switchToHref: (path) => toEnglish(path),
  },
};

/** `/n8n-developer` -> `/ar/n8n-developer`; `/` -> `/ar/`. */
export function toArabic(path: string): string {
  if (path === '/ar' || path.startsWith('/ar/')) return path;
  return path === '/' ? '/ar/' : `/ar${path}`;
}

/** The inverse. `/ar/` -> `/`. */
export function toEnglish(path: string): string {
  if (path !== '/ar' && !path.startsWith('/ar/')) return path;
  const stripped = path.replace(/^\/ar/, '');
  return stripped === '' || stripped === '/' ? '/' : stripped;
}

/**
 * The translated page pairs, as paths. Exported so the sitemap, the pages, and
 * the language switcher read from ONE list — hreflang only counts when it is
 * reciprocal, and the cheapest way to guarantee that is to never write the pairs
 * down twice.
 */
export const TRANSLATED: { en: string; ar: string }[] = [
  { en: '/', ar: '/ar/' },
  { en: '/n8n-developer', ar: '/ar/n8n-developer' },
  { en: '/ai-automation-developer', ar: '/ar/ai-automation-developer' },
  { en: '/vibe-coder', ar: '/ar/vibe-coder' },
  { en: '/contact', ar: '/ar/contact' },
  { en: '/blog/', ar: '/ar/blog/' },
];

/**
 * Trailing slashes are normalised away so `/n8n-developer/` and
 * `/n8n-developer` resolve to the same pair. `/` and `/ar/` are exempt, because
 * for them the slash IS the path.
 */
function normalisePath(path: string): string {
  return path === '/' || path === '/ar/' ? path : path.replace(/\/$/, '');
}

/**
 * The `altLocales` object for a path, or undefined when the page has no
 * translation.
 *
 * BOTH sides are normalised before comparing, and that is the whole point. This
 * used to normalise only the incoming path and compare it against the raw table,
 * which silently failed for any pair whose stored value carried a trailing
 * slash: `/blog/` normalised to `/blog`, the table held `/blog/`, nothing
 * matched, and the blog pair emitted no hreflang at all in EITHER language.
 * Every other pair happened to be slash-free, so the bug stayed invisible until
 * the blog pair was added.
 *
 * The stored values keep their trailing slashes deliberately: they are emitted
 * as hreflang hrefs and must match each page's canonical URL exactly.
 */
export function altLocalesFor(path: string): { en: string; ar: string } | undefined {
  const normalised = normalisePath(path);
  return TRANSLATED.find(
    (p) => normalisePath(p.en) === normalised || normalisePath(p.ar) === normalised
  );
}
