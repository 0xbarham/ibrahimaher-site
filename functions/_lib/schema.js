// Column allowlist per D1 table, mirrors schema.sql. Used to validate table
// names (prevents SQL injection via identifiers, which D1 cannot parametrize)
// and to whitelist which fields the content API will read or write.

export const TABLE_COLUMNS = {
  jobs: ['sort_order', 'eyebrow', 'title', 'company', 'date_range', 'body_html', 'tags_json', 'logo_light', 'logo_dark'],
  projects: ['sort_order', 'title', 'body_html', 'tags_json', 'icon_light', 'icon_dark', 'featured', 'featured_logo', 'external_url', 'external_label'],
  skills: ['sort_order', 'category', 'subtitle', 'tags_json'],
  certifications: ['sort_order', 'title', 'issuer'],
  education: ['sort_order', 'title', 'school', 'date_range', 'body_html'],
  posts: ['sort_order', 'slug', 'title', 'category', 'excerpt', 'post_date', 'read_time'],
};
