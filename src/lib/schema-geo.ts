/**
 * Shared geography and service-offer nodes for ProfessionalService JSON-LD.
 *
 * These used to be inlined per page, which is how /n8n-developer,
 * /ai-automation-developer and /vibe-coder each ended up claiming `areaServed:
 * [Erbil, Kurdistan Region, Iraq]` — accurate, but far narrower than the work
 * actually is. Erbil is a small share of Iraq's population; Baghdad alone is
 * roughly a quarter of it, and this work is delivered remotely, so there was
 * never a delivery reason for the narrow claim.
 *
 * Naming the governorates explicitly is not keyword stuffing: `areaServed`
 * accepts a list of places precisely so a remote-capable provider can state its
 * real service area, and a City node is the machine-readable form of the same
 * sentence the page already makes in prose.
 */

/** The governorate capitals that carry the country's commercial demand. */
const IRAQ_CITIES = [
  'Baghdad',
  'Erbil',
  'Basra',
  'Mosul',
  'Sulaymaniyah',
  'Najaf',
  'Karbala',
  'Kirkuk',
  'Duhok',
] as const;

export const IRAQ_AREA_SERVED = [
  ...IRAQ_CITIES.map((name) => ({ '@type': 'City' as const, name })),
  { '@type': 'AdministrativeArea' as const, name: 'Kurdistan Region' },
  { '@type': 'Country' as const, name: 'Iraq' },
  'Worldwide (remote)',
];

function offer(name: string, serviceType: string) {
  return {
    '@type': 'Offer' as const,
    itemOffered: { '@type': 'Service' as const, name, serviceType },
  };
}

/**
 * `makesOffer` takes Offers directly. The original pages wrapped a single
 * OfferCatalog in it, which is out of range for the property — carried over
 * verbatim from a live-site snapshot and flagged in that file's own comment as
 * something to fix during consolidation. This is that consolidation, so the
 * shape is corrected here rather than propagated into four more pages.
 */
export const SERVICE_OFFERS = [
  offer('n8n workflow automation', 'n8n workflow automation'),
  offer('AI agent & chatbot development', 'AI agent development'),
  offer('WhatsApp & Instagram automation', 'Conversational automation'),
  offer('AI invoice & lead automation', 'AI document and lead automation'),
  offer('Business process automation', 'Business process automation'),
  offer('Integrations & custom n8n function nodes', 'API integration'),
];

export const ARABIC_SERVICE_OFFERS = [
  offer('أتمتة سير العمل بـ n8n', 'n8n workflow automation'),
  offer('وكلاء الذكاء الاصطناعي والشات بوت', 'AI agent development'),
  offer('أتمتة واتساب وإنستغرام', 'Conversational automation'),
  offer('أتمتة الفواتير والعملاء المحتملين', 'AI document and lead automation'),
  offer('أتمتة عمليات الأعمال', 'Business process automation'),
  offer('التكاملات والعُقد البرمجية المخصصة', 'API integration'),
];
