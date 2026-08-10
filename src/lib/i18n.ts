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
 * Arabic has no /ar/about or /ar/blog yet, so its nav links the pages that do
 * exist. /ar/contact is deliberately among them: it is where every CTA on the
 * Arabic pages lands, and routing the site's one conversion action through an
 * English form was the largest leak in the Arabic funnel.
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
      { href: '/ar/', label: 'الرئيسية' },
      { href: '/ar/n8n-developer', label: 'مطوّر n8n' },
      { href: '/ar/ai-automation-developer', label: 'أتمتة الذكاء الاصطناعي' },
      { href: '/ar/vibe-coder', label: 'برمجة بالذكاء الاصطناعي' },
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
];

/**
 * The `altLocales` object for a path, or undefined when the page has no
 * translation. Trailing slashes are normalised away first so `/n8n-developer/`
 * and `/n8n-developer` resolve to the same pair; `/` and `/ar/` are exempt
 * because for them the slash IS the path.
 */
export function altLocalesFor(path: string): { en: string; ar: string } | undefined {
  const normalised = path === '/' || path === '/ar/' ? path : path.replace(/\/$/, '');
  return TRANSLATED.find((p) => p.en === normalised || p.ar === normalised);
}
