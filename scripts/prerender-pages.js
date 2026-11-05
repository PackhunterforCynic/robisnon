/**
 * Static SEO Page Prerender Script
 * Generates pre-rendered HTML files with unique titles, meta descriptions,
 * canonical links, and semantic fallback DOM for all 27 indexable routes.
 * 
 * Ensures 100/100 Lighthouse SEO and zero duplicate page titles/descriptions
 * across search crawlers and social scrapers.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

const SITE_URL = 'https://robinsonj.vercel.app';

/** @type {Array<{ path: string, title: string, description: string, h1: string, summary: string, keywords?: string, ogType?: string }>} */
const pages = [
  // 1. Core Navigation Pages
  {
    path: '/',
    title: 'Robinson J. | Creative Technologist & Filmmaker',
    description: 'Portfolio of Robinson J., a Creative Technologist, Software Developer, and Cinematographer specializing in building modern web experiences and visual storytelling.',
    h1: 'Robinson J. — Creative Technologist & Filmmaker',
    summary: 'Crafting high-performance digital experiences, scalable cloud systems, and cinematic visual stories.',
  },
  {
    path: '/projects',
    title: 'Featured Software & Creative Projects | Robinson J.',
    description: 'Explore interactive web applications, high-performance engines, visual storytelling tools, and full-stack software systems engineered by Robinson J.',
    h1: 'Featured Engineering & Creative Projects',
    summary: 'A curated showcase of software engineering systems, interactive web applications, and digital products.',
  },
  {
    path: '/blog',
    title: 'Engineering, Performance & Creative Tech Blog | Robinson J.',
    description: 'In-depth articles and tutorials on modern web performance, scalable architecture, cinematography, and search engine optimization by Robinson J.',
    h1: 'Engineering & Creative Tech Blog',
    summary: 'Thoughts, case studies, and practical guides on scalable web architecture, sub-second performance, and visual storytelling.',
  },
  {
    path: '/stories',
    title: 'Visual Google Web Stories | Robinson J.',
    description: 'Bite-sized, fast-loading, visually rich Google Web Stories exploring creative technology, performance engineering, and cinematography.',
    h1: 'Visual Google Web Stories',
    summary: 'Interactive, mobile-first visual stories exploring modern software engineering, web performance, and cinematic techniques.',
  },
  {
    path: '/skills',
    title: 'Technical Capabilities & Creative Skills | Robinson J.',
    description: 'Comprehensive breakdown of technical capabilities: TypeScript, React, Next.js, Node.js, WebGL/Three.js, PostgreSQL, Docker, and cinematography.',
    h1: 'Technical & Creative Capabilities',
    summary: 'Full-stack engineering proficiency across modern JavaScript/TypeScript, cloud infrastructure, performance optimization, and visual arts.',
  },
  {
    path: '/about',
    title: 'About Robinson J. | Creative Technologist & Filmmaker',
    description: 'Learn about Robinson J., a passionate Creative Technologist and Filmmaker bridging cutting-edge web software engineering with cinematic narrative craft.',
    h1: 'About Robinson J.',
    summary: 'Bridging engineering rigor with artistic storytelling to craft unforgettable digital and visual experiences.',
  },
  {
    path: '/contact',
    title: 'Contact Robinson J. | Software & Creative Inquiries',
    description: 'Get in touch with Robinson J. for software engineering roles, web development consulting, creative direction, and cinematic visual projects.',
    h1: 'Contact & Collaboration Inquiries',
    summary: 'Available for innovative software development roles, freelance web engineering, and creative visual collaborations.',
  },
  {
    path: '/films',
    title: 'Cinematography & Visual Films | Robinson J.',
    description: 'Cinematic visual work, short films, directing, visual storytelling, and color grading crafted by Robinson J.',
    h1: 'Cinematography & Film Direction',
    summary: 'Cinematic productions, narrative visual storytelling, and dynamic camera direction.',
  },
  {
    path: '/photography',
    title: 'Visual Photography & Aesthetic Studies | Robinson J.',
    description: 'Still photography, composition studies, architectural framing, and street portraits by Robinson J.',
    h1: 'Visual Photography & Aesthetic Studies',
    summary: 'Visual exploration through light, texture, architectural geometry, and human portraiture.',
  },

  // 2. High-Value Blog Articles
  {
    path: '/blog/building-cinematic-web-experiences',
    title: 'Building Cinematic Web Experiences with Modern Frontend Tech | Robinson J.',
    description: 'How to blend WebGL, GSAP, and buttery 60fps micro-interactions without sacrificing accessibility or web performance.',
    h1: 'Building Cinematic Web Experiences with Modern Frontend Tech',
    summary: 'A deep dive into blending WebGL, GSAP, and 60fps micro-interactions while maintaining sub-second performance.',
    ogType: 'article',
  },
  {
    path: '/blog/scalable-web-architecture-2026',
    title: 'Scalable Serverless Web Architecture in 2026 | Robinson J.',
    description: 'Architectural breakdown of high-concurrency, zero-maintenance modern serverless infrastructure on edge runtimes.',
    h1: 'Scalable Serverless Web Architecture in 2026',
    summary: 'Designing high-throughput serverless systems using modern edge functions, connection pooling, and smart caching.',
    ogType: 'article',
  },
  {
    path: '/blog/visual-storytelling-meets-code',
    title: 'Visual Storytelling Meets Code: A Director\'s Perspective | Robinson J.',
    description: 'Drawing parallels between film cinematography and responsive UI/UX architecture to craft emotionally resonant software.',
    h1: 'Visual Storytelling Meets Code: A Director\'s Perspective',
    summary: 'How cinematic lighting, pacing, and visual framing inform superior user interface design and emotional resonance.',
    ogType: 'article',
  },
  {
    path: '/blog/mastering-modern-seo',
    title: 'Mastering Modern SEO: Zero-Duplicate Indexing & Structured Data | Robinson J.',
    description: 'A technical guide to achieving 100/100 Lighthouse SEO, clean canonical routing, and automated rich snippets in modern web apps.',
    h1: 'Mastering Modern SEO: Zero-Duplicate Indexing & Structured Data',
    summary: 'Engineering techniques for perfect search indexation, canonical purity, and dynamic JSON-LD structured data.',
    ogType: 'article',
  },

  // 3. Google Web Stories
  {
    path: '/stories/creative-technologist-journey',
    title: 'The Journey of a Creative Technologist | Web Story | Robinson J.',
    description: 'A visual story detailing how engineering precision and cinematic vision combine to build next-generation web products.',
    h1: 'The Journey of a Creative Technologist',
    summary: 'An interactive visual story traversing the intersection of software development and cinematic arts.',
    ogType: 'article',
  },
  {
    path: '/stories/sub-second-web-performance',
    title: 'Achieving Sub-Second Web Performance | Web Story | Robinson J.',
    description: 'Key visual techniques for achieving 100% Lighthouse performance scores and instant interaction latency.',
    h1: 'Achieving Sub-Second Web Performance',
    summary: 'Visual breakdown of modern web vitals optimization: LCP reduction, asset compression, and paint budgeting.',
    ogType: 'article',
  },
  {
    path: '/stories/cinematic-lighting-principles',
    title: 'Cinematic Lighting Principles Applied to UI | Web Story | Robinson J.',
    description: 'How Hollywood 3-point lighting and atmospheric color contrast translate to high-end digital design systems.',
    h1: 'Cinematic Lighting Principles Applied to UI',
    summary: 'Translating cinematic lighting, luminance hierarchies, and depth cues into modern digital interface systems.',
    ogType: 'article',
  },

  // 4. Featured Projects
  {
    path: '/projects/flash-bites',
    title: 'Flash Bites — High-Speed Food Ordering Web App | Robinson J.',
    description: 'Lightning-fast food ordering web application built with React, Vite, and modern responsive design.',
    h1: 'Flash Bites — High-Speed Food Ordering Web App',
    summary: 'Ultra-fast food ordering digital experience engineered with React, real-time cart state, and responsive styling.',
  },
  {
    path: '/projects/fairswitch',
    title: 'Fair Switch — Intelligent Utility Switching Platform | Robinson J.',
    description: 'Comprehensive web platform enabling seamless utility switching and transparent energy comparisons.',
    h1: 'Fair Switch — Intelligent Utility Switching Platform',
    summary: 'Energy tariff comparison and utility switching engine with transparent calculation algorithms.',
  },
  {
    path: '/projects/smartserve',
    title: 'SmartServe — Automated Hospitality Management System | Robinson J.',
    description: 'Smart hospitality ordering and queue management system engineered for high-throughput venues.',
    h1: 'SmartServe — Automated Hospitality Management System',
    summary: 'Venue management, digital menu ordering, and kitchen queue automation system.',
  },
  {
    path: '/projects/havilah-studio',
    title: 'Havilah Studio — Creative Production & Portfolio | Robinson J.',
    description: 'Boutique creative studio portfolio highlighting film production, sound design, and cinematography.',
    h1: 'Havilah Studio — Creative Production & Portfolio',
    summary: 'Creative portfolio presenting original video production, audio design, and post-production craft.',
  },
  {
    path: '/projects/musica',
    title: 'Musica — Interactive Audio Streaming Web Application | Robinson J.',
    description: 'Modern audio streaming interface with dynamic waveforms, low-latency playback, and custom playlists.',
    h1: 'Musica — Interactive Audio Streaming Web Application',
    summary: 'Interactive web audio player with waveform visualization and responsive playlist controls.',
  },
  {
    path: '/projects/love-bites',
    title: 'Love Bites — Artisanal Culinary E-Commerce Store | Robinson J.',
    description: 'Artisanal bakery and gourmet dessert digital storefront with seamless mobile checkout.',
    h1: 'Love Bites — Artisanal Culinary E-Commerce Store',
    summary: 'Modern e-commerce showcase for gourmet bakeries featuring streamlined checkout and interactive menus.',
  },
  {
    path: '/projects/unite-25',
    title: 'Unite 25 — Tech Conference & Community Platform | Robinson J.',
    description: 'Annual technology summit portal featuring interactive speaker schedules, live ticketing, and attendee networking.',
    h1: 'Unite 25 — Tech Conference & Community Platform',
    summary: 'Event platform with real-time speaker scheduling, ticket registration, and attendee interaction.',
  },
  {
    path: '/projects/hse-digital',
    title: 'HSE Digital — Enterprise Cloud Solutions & Safety | Robinson J.',
    description: 'Enterprise occupational safety and compliance monitoring suite with real-time audit reporting.',
    h1: 'HSE Digital — Enterprise Cloud Solutions & Safety',
    summary: 'Cloud compliance platform facilitating workplace hazard audits and digital incident logs.',
  },
  {
    path: '/projects/jj-enterprises',
    title: 'JJ Enterprises — Supply Chain & Logistics Management | Robinson J.',
    description: 'Global trade and logistics management dashboard with real-time shipment telemetry.',
    h1: 'JJ Enterprises — Supply Chain & Logistics Management',
    summary: 'Real-time shipment tracking, inventory management, and freight analytics dashboard.',
  },
  {
    path: '/projects/amazon-affiliate',
    title: 'Curated Amazon Affiliate Engine & Product Portal | Robinson J.',
    description: 'High-conversion affiliate curation platform with dynamic pricing APIs and automated SEO schema.',
    h1: 'Curated Amazon Affiliate Engine & Product Portal',
    summary: 'High-converting affiliate curation portal with product filtering, comparison grids, and SEO schema.',
  },
  {
    path: '/projects/personal-portfolio',
    title: 'Creative Technologist Portfolio Engine | Robinson J.',
    description: 'Custom ultra-lightweight portfolio engineered with React, Vite, Lenis smooth scroll, GSAP, and Telegram Visitor Bot.',
    h1: 'Creative Technologist Portfolio Engine',
    summary: 'Modern high-performance portfolio featuring Lenis smooth scrolling, GSAP animations, and zero-database Telegram telemetry.',
  },
];

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function prerender() {
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    console.error('[Prerender] Error: dist/index.html not found! Run vite build first.');
    process.exit(1);
  }

  const baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  console.log(`[Prerender] Generating static HTML for ${pages.length} indexable pages...`);

  let count = 0;
  for (const page of pages) {
    const canonicalUrl = page.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${page.path}`;
    const safeTitle = escapeHtml(page.title);
    const safeDesc = escapeHtml(page.description);
    const safeH1 = escapeHtml(page.h1);
    const safeSummary = escapeHtml(page.summary);

    let html = baseHtml;

    // Update <title>
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${safeTitle}</title>`);
    html = html.replace(/<meta\s+name="title"\s+content="[^"]*"\s*\/?>/i, `<meta name="title" content="${safeTitle}" />`);

    // Update <meta name="description">
    html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${safeDesc}" />`);

    // Update canonical
    html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${canonicalUrl}" />`);

    // Update Open Graph tags
    html = html.replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${safeTitle}" />`);
    html = html.replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${safeDesc}" />`);
    html = html.replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${canonicalUrl}" />`);
    if (page.ogType) {
      html = html.replace(/<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:type" content="${page.ogType}" />`);
    }

    // Update Twitter tags
    html = html.replace(/<meta\s+property="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="twitter:title" content="${safeTitle}" />`);
    html = html.replace(/<meta\s+property="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="twitter:description" content="${safeDesc}" />`);
    html = html.replace(/<meta\s+property="twitter:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="twitter:url" content="${canonicalUrl}" />`);

    // Inject page-specific JSON-LD Schema
    let extraJsonLd = '';
    if (page.path.startsWith('/blog/')) {
      extraJsonLd = `\n  <script type="application/ld+json">\n  {\n    "@context": "https://schema.org",\n    "@type": "BlogPosting",\n    "headline": ${JSON.stringify(page.title)},\n    "description": ${JSON.stringify(page.description)},\n    "url": "${canonicalUrl}",\n    "author": { "@type": "Person", "name": "Robinson J.", "url": "https://robinsonj.vercel.app/" },\n    "publisher": { "@type": "Person", "name": "Robinson J." }\n  }\n  </script>`;
    } else if (page.path.startsWith('/stories/')) {
      extraJsonLd = `\n  <script type="application/ld+json">\n  {\n    "@context": "https://schema.org",\n    "@type": "CreativeWork",\n    "name": ${JSON.stringify(page.title)},\n    "headline": ${JSON.stringify(page.title)},\n    "description": ${JSON.stringify(page.description)},\n    "url": "${canonicalUrl}",\n    "author": { "@type": "Person", "name": "Robinson J." }\n  }\n  </script>`;
    } else if (page.path.startsWith('/projects/')) {
      extraJsonLd = `\n  <script type="application/ld+json">\n  {\n    "@context": "https://schema.org",\n    "@type": "SoftwareApplication",\n    "name": ${JSON.stringify(page.h1)},\n    "description": ${JSON.stringify(page.description)},\n    "url": "${canonicalUrl}",\n    "applicationCategory": "WebApplication",\n    "author": { "@type": "Person", "name": "Robinson J." }\n  }\n  </script>`;
    }

    if (extraJsonLd) {
      html = html.replace('</head>', `${extraJsonLd}\n</head>`);
    }

    // Inject semantic body fallback into <div id="root">
    const semanticFallback = `  <div id="root">
    <header>
      <h1>${safeH1}</h1>
      <p>${safeSummary}</p>
    </header>
    <nav aria-label="Primary Site Navigation">
      <a href="/">Home</a>
      <a href="/projects">Projects</a>
      <a href="/blog">Blog</a>
      <a href="/stories">Web Stories</a>
      <a href="/skills">Skills</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
      <a href="/films">Films</a>
      <a href="/photography">Photography</a>
    </nav>
  </div>`;

    html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, semanticFallback);

    if (page.path === '/') {
      // Overwrite dist/index.html with the normalized root
      fs.writeFileSync(indexHtmlPath, html, 'utf8');
      count++;
    } else {
      const cleanPath = page.path.replace(/^\/+/, '');
      const outDir = path.join(distDir, cleanPath);
      fs.mkdirSync(outDir, { recursive: true });

      // Write dist/path/index.html (for directory routing)
      fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

      // Write dist/path.html (for cleanUrls routing)
      fs.writeFileSync(`${outDir}.html`, html, 'utf8');

      count++;
    }
  }

  console.log(`[Prerender] Successfully generated static pre-rendered pages for ${count} routes.`);
}

prerender();
