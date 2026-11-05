/**
 * Dynamic SEO & Canonical Engine for React SPA
 * Ensures unique self-referencing canonical URLs, rich meta tags, and structured JSON-LD schemas
 * Guarantees zero duplicate content penalty.
 */

export interface SEOProps {
  title: string;
  description: string;
  canonicalPath: string;
  keywords?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  publishedTime?: string;
  author?: string;
  schema?: Record<string, any> | Record<string, any>[];
}

const SITE_ORIGIN = 'https://robinsonj.vercel.app';
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/logo.jpg`;

export function updateMetaTags(props: SEOProps): void {
  if (typeof window === 'undefined') return;

  const {
    title,
    description,
    canonicalPath,
    keywords,
    ogImage = DEFAULT_OG_IMAGE,
    ogType = 'website',
    publishedTime,
    author = 'Robinson J.',
    schema,
  } = props;

  // 1. Clean canonical URL (no trailing slash except root)
  const cleanPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
  const canonicalUrl = cleanPath === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${cleanPath.replace(/\/+$/, '')}`;

  // 2. Document Title
  const formattedTitle = title.includes('Robinson J') ? title : `${title} | Robinson J.`;
  document.title = formattedTitle;

  // Helper to update or create meta tag
  const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
    let elem = document.querySelector(`meta[${attr}="${key}"]`);
    if (!elem) {
      elem = document.createElement('meta');
      elem.setAttribute(attr, key);
      document.head.appendChild(elem);
    }
    elem.setAttribute('content', content);
  };

  // 3. Primary Meta Tags
  setMeta('name', 'title', formattedTitle);
  setMeta('name', 'description', description);
  if (keywords) setMeta('name', 'keywords', keywords);
  setMeta('name', 'author', author);

  // 4. Strict Self-Referencing Canonical Tag
  let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  // 5. Open Graph / Facebook
  setMeta('property', 'og:type', ogType);
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('property', 'og:title', formattedTitle);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', ogImage);

  // 6. Twitter
  setMeta('property', 'twitter:card', 'summary_large_image');
  setMeta('property', 'twitter:url', canonicalUrl);
  setMeta('property', 'twitter:title', formattedTitle);
  setMeta('property', 'twitter:description', description);
  setMeta('property', 'twitter:image', ogImage);

  if (publishedTime) {
    setMeta('property', 'article:published_time', publishedTime);
  }

  // 7. Dynamic JSON-LD Structured Data
  let scriptTag = document.querySelector('script#dynamic-jsonld') as HTMLScriptElement | null;
  if (!scriptTag) {
    scriptTag = document.createElement('script');
    scriptTag.id = 'dynamic-jsonld';
    scriptTag.type = 'application/ld+json';
    document.head.appendChild(scriptTag);
  }

  // Default rich person & website schema + custom schema
  const defaultSchemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Robinson J.',
      url: SITE_ORIGIN,
      image: `${SITE_ORIGIN}/logo.jpg`,
      jobTitle: ['Creative Technologist', 'Software Developer', 'Cinematographer'],
      worksFor: {
        '@type': 'Organization',
        name: 'Robinson J. Studio',
      },
      sameAs: [
        'https://linkedin.com/in/robinson-mj',
        'https://github.com/PackhunterforCynic',
        'https://wa.me/918668136756',
      ],
      description: 'Creative Technologist, Software Developer, and Cinematographer specializing in building modern web experiences and visual storytelling.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Robinson J. Portfolio',
      url: SITE_ORIGIN,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_ORIGIN}/projects?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];

  const finalSchema = schema ? (Array.isArray(schema) ? [...defaultSchemas, ...schema] : [...defaultSchemas, schema]) : defaultSchemas;
  scriptTag.textContent = JSON.stringify(finalSchema);
}
