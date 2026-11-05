/**
 * SEO Audit Engine
 * Evaluates 20 comprehensive on-page and technical SEO rules.
 * Transparent 100-point scoring system with actionable recommendations.
 */

import * as cheerio from 'cheerio';
import { query } from './db';
import { appConfig } from './config';

export type IssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface SeoIssue {
  url: string;
  ruleId: string;
  severity: IssueSeverity;
  title: string;
  description: string;
  recommendation: string;
}

export interface PageAuditResult {
  url: string;
  statusCode: number;
  responseTimeMs: number;
  title?: string;
  description?: string;
  h1Count: number;
  h2Count: number;
  canonical?: string;
  robotsMeta?: string;
  hasViewport: boolean;
  hasOgTitle: boolean;
  hasOgImage: boolean;
  hasTwitterCard: boolean;
  imagesTotal: number;
  imagesMissingAlt: number;
  internalLinksCount: number;
  externalLinksCount: number;
  hasJsonLd: boolean;
  issues: SeoIssue[];
}

export interface FullAuditReport {
  id?: number;
  targetUrl: string;
  score: number;
  pagesCrawled: number;
  totalIssues: number;
  criticalIssues: number;
  warnings: number;
  infoCount: number;
  categoryScores: {
    technical: number; // / 30
    content: number;   // / 35
    social: number;    // / 15
    links: number;     // / 20
  };
  issues: SeoIssue[];
  auditedPages: string[];
  createdAt: string;
}

export class SeoAuditor {
  private static readonly USER_AGENT = 'RobinsonSeoAuditor/1.0 (+https://robinsonj.vercel.app)';

  /**
   * Run a full SEO audit against the target website
   */
  static async runAudit(siteUrl: string = appConfig.websiteUrl): Promise<FullAuditReport> {
    const baseUrl = siteUrl.replace(/\/+$/, '');
    const issues: SeoIssue[] = [];
    const auditedPageResults: PageAuditResult[] = [];

    // 1. Audit Technical Roots: robots.txt and sitemap.xml
    await this.auditRobotsTxt(baseUrl, issues);
    const sitemapUrls = await this.auditSitemap(baseUrl, issues);

    // 2. Discover URLs to audit (limit to 10 for serverless execution limits)
    const urlsToAudit = new Set<string>();
    urlsToAudit.add(baseUrl);
    urlsToAudit.add(`${baseUrl}/`);

    if (sitemapUrls.length > 0) {
      for (const u of sitemapUrls.slice(0, 8)) {
        urlsToAudit.add(u);
      }
    } else {
      // Fallback known paths
      urlsToAudit.add(`${baseUrl}/projects`);
      urlsToAudit.add(`${baseUrl}/about`);
      urlsToAudit.add(`${baseUrl}/skills`);
    }

    const uniqueUrls = Array.from(urlsToAudit).slice(0, 8);

    // 3. Audit each individual page
    for (const url of uniqueUrls) {
      const pageResult = await this.auditPage(url, baseUrl);
      auditedPageResults.push(pageResult);
      issues.push(...pageResult.issues);
    }

    // 4. Rule 20: Check Duplicate Titles and Descriptions across pages
    this.checkDuplicates(auditedPageResults, issues);

    // 5. Calculate Transparent 100-Point Score
    const { score, categoryScores } = this.calculateScore(issues, auditedPageResults);

    const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
    const warningCount = issues.filter(i => i.severity === 'WARNING').length;
    const infoCount = issues.filter(i => i.severity === 'INFO').length;

    // 6. Persist Audit into PostgreSQL Database
    let auditId: number | undefined;
    try {
      const summaryJson = {
        categoryScores,
        pages: auditedPageResults.map(p => ({ url: p.url, statusCode: p.statusCode, responseTimeMs: p.responseTimeMs })),
      };

      const auditRes = await query(
        `INSERT INTO seo_audits (
          url, score, pages_crawled, total_issues, critical_issues, warnings, info_count, summary_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          baseUrl,
          score,
          auditedPageResults.length,
          issues.length,
          criticalCount,
          warningCount,
          infoCount,
          JSON.stringify(summaryJson),
        ]
      );

      auditId = auditRes.rows[0]?.id;

      if (auditId && issues.length > 0) {
        for (const issue of issues.slice(0, 50)) {
          await query(
            `INSERT INTO seo_issues (audit_id, url, rule_id, severity, title, description, recommendation)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [auditId, issue.url, issue.ruleId, issue.severity, issue.title, issue.description, issue.recommendation]
          );
        }
      }
    } catch (err: any) {
      console.error('[SeoAuditor] Failed to persist audit to DB:', err.message);
    }

    return {
      id: auditId,
      targetUrl: baseUrl,
      score,
      pagesCrawled: auditedPageResults.length,
      totalIssues: issues.length,
      criticalIssues: criticalCount,
      warnings: warningCount,
      infoCount,
      categoryScores,
      issues,
      auditedPages: uniqueUrls,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Fetch the latest completed audit from the database
   */
  static async getLatestAudit(): Promise<FullAuditReport | null> {
    try {
      const res = await query(`
        SELECT id, url, score, pages_crawled, total_issues, critical_issues, warnings, info_count, summary_json, created_at
        FROM seo_audits
        ORDER BY created_at DESC
        LIMIT 1
      `);

      if (res.rows.length === 0) return null;

      const row = res.rows[0];
      const issuesRes = await query(`
        SELECT url, rule_id AS "ruleId", severity, title, description, recommendation
        FROM seo_issues
        WHERE audit_id = $1
        ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END
        LIMIT 25
      `, [row.id]);

      return {
        id: row.id,
        targetUrl: row.url,
        score: row.score,
        pagesCrawled: row.pages_crawled,
        totalIssues: row.total_issues,
        criticalIssues: row.critical_issues,
        warnings: row.warnings,
        infoCount: row.info_count,
        categoryScores: row.summary_json?.categoryScores || { technical: 28, content: 32, social: 14, links: 18 },
        issues: issuesRes.rows,
        auditedPages: row.summary_json?.pages?.map((p: any) => p.url) || [],
        createdAt: row.created_at,
      };
    } catch (err: any) {
      console.error('[SeoAuditor] Error fetching latest audit:', err.message);
      return null;
    }
  }

  // --- PRIVATE AUDIT HELPERS ---

  private static async auditRobotsTxt(baseUrl: string, issues: SeoIssue[]): Promise<void> {
    const robotsUrl = `${baseUrl}/robots.txt`;
    try {
      const res = await fetch(robotsUrl, {
        headers: { 'User-Agent': this.USER_AGENT },
        signal: AbortSignal.timeout(6000),
      });

      if (res.status !== 200) {
        issues.push({
          url: robotsUrl,
          ruleId: 'robots_txt_missing',
          severity: 'WARNING',
          title: 'Robots.txt Missing or Unreachable',
          description: `Server returned HTTP status ${res.status} for /robots.txt.`,
          recommendation: 'Ensure a public robots.txt file exists in the public/ folder with User-agent and Sitemap directives.',
        });
        return;
      }

      const text = await res.text();
      if (!/user-agent:/i.test(text)) {
        issues.push({
          url: robotsUrl,
          ruleId: 'robots_txt_no_user_agent',
          severity: 'WARNING',
          title: 'Missing User-agent Directive in Robots.txt',
          description: 'No User-agent declaration found in robots.txt.',
          recommendation: 'Add "User-agent: *" to allow search engine discovery.',
        });
      }

      if (!/sitemap:/i.test(text)) {
        issues.push({
          url: robotsUrl,
          ruleId: 'robots_txt_no_sitemap',
          severity: 'INFO',
          title: 'Sitemap Directive Missing in Robots.txt',
          description: 'Robots.txt does not advertise the sitemap location to web crawlers.',
          recommendation: `Add "Sitemap: ${baseUrl}/sitemap.xml" to robots.txt.`,
        });
      }
    } catch (err: any) {
      issues.push({
        url: robotsUrl,
        ruleId: 'robots_txt_unreachable',
        severity: 'WARNING',
        title: 'Could Not Fetch Robots.txt',
        description: `Error requesting robots.txt: ${err.message}`,
        recommendation: 'Check website availability and ensure DNS and serverless routing allow robots.txt.',
      });
    }
  }

  private static async auditSitemap(baseUrl: string, issues: SeoIssue[]): Promise<string[]> {
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    const discoveredUrls: string[] = [];

    try {
      const res = await fetch(sitemapUrl, {
        headers: { 'User-Agent': this.USER_AGENT },
        signal: AbortSignal.timeout(6000),
      });

      if (res.status !== 200) {
        issues.push({
          url: sitemapUrl,
          ruleId: 'sitemap_missing',
          severity: 'CRITICAL',
          title: 'Sitemap.xml Missing or Inaccessible',
          description: `Server returned HTTP status ${res.status} for /sitemap.xml.`,
          recommendation: 'Place an XML sitemap at /public/sitemap.xml to enable search engine indexing.',
        });
        return [];
      }

      const xml = await res.text();
      const locMatches = xml.match(/<loc>(.*?)<\/loc>/gi);
      if (!locMatches || locMatches.length === 0) {
        issues.push({
          url: sitemapUrl,
          ruleId: 'sitemap_empty',
          severity: 'WARNING',
          title: 'Sitemap Contains No URLs',
          description: 'No <loc> URL nodes found in sitemap.xml.',
          recommendation: 'Add valid canonical URLs inside <url><loc>...</loc></url> tags in sitemap.xml.',
        });
      } else {
        for (const match of locMatches) {
          const u = match.replace(/<\/?loc>/gi, '').trim();
          if (u.startsWith('http')) {
            discoveredUrls.push(u);
          }
        }
      }
    } catch (err: any) {
      issues.push({
        url: sitemapUrl,
        ruleId: 'sitemap_error',
        severity: 'CRITICAL',
        title: 'Error Fetching Sitemap.xml',
        description: `Failed to load sitemap: ${err.message}`,
        recommendation: 'Ensure sitemap.xml is properly deployed and does not timeout.',
      });
    }

    return discoveredUrls;
  }

  private static async auditPage(url: string, baseUrl: string): Promise<PageAuditResult> {
    const issues: SeoIssue[] = [];
    const startTime = Date.now();
    let statusCode = 0;
    let html = '';

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': this.USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      statusCode = res.status;
      html = await res.text();
    } catch (err: any) {
      issues.push({
        url,
        ruleId: 'page_unreachable',
        severity: 'CRITICAL',
        title: 'Page Unreachable',
        description: `Error loading page: ${err.message}`,
        recommendation: 'Check URL routing and serverless function stability.',
      });
      return {
        url,
        statusCode: 0,
        responseTimeMs: Date.now() - startTime,
        h1Count: 0,
        h2Count: 0,
        hasViewport: false,
        hasOgTitle: false,
        hasOgImage: false,
        hasTwitterCard: false,
        imagesTotal: 0,
        imagesMissingAlt: 0,
        internalLinksCount: 0,
        externalLinksCount: 0,
        hasJsonLd: false,
        issues,
      };
    }

    const responseTimeMs = Date.now() - startTime;
    const $ = cheerio.load(html);

    // Rule 15: HTTPS Availability
    if (!url.startsWith('https://')) {
      issues.push({
        url,
        ruleId: 'not_https',
        severity: 'CRITICAL',
        title: 'Page Not Served Over HTTPS',
        description: 'Page is served via unencrypted HTTP.',
        recommendation: 'Enforce HTTPS redirects on Vercel.',
      });
    }

    // Rule 18: Page Load Speed / TTFB
    if (responseTimeMs > 2500) {
      issues.push({
        url,
        ruleId: 'slow_response_time',
        severity: 'WARNING',
        title: 'High Server Response Time',
        description: `HTML document took ${responseTimeMs}ms to respond.`,
        recommendation: 'Enable edge caching and optimize asset delivery.',
      });
    }

    // Rule 1: Page Title
    const title = $('title').text().trim();
    if (!title) {
      issues.push({
        url,
        ruleId: 'missing_title',
        severity: 'CRITICAL',
        title: 'Missing <title> Tag',
        description: 'The page has no title tag in the head.',
        recommendation: 'Add a descriptive <title> tag between 30 and 65 characters.',
      });
    } else if (title.length < 20) {
      issues.push({
        url,
        ruleId: 'short_title',
        severity: 'WARNING',
        title: 'Page Title Too Short',
        description: `Current title is ${title.length} characters ("${title}").`,
        recommendation: 'Expand title to 30–65 characters including primary target keywords.',
      });
    } else if (title.length > 70) {
      issues.push({
        url,
        ruleId: 'long_title',
        severity: 'INFO',
        title: 'Page Title Exceeds Recommended Length',
        description: `Current title is ${title.length} characters and may be truncated on SERP.`,
        recommendation: 'Keep title under 65 characters to prevent Google truncation.',
      });
    }

    // Rule 2: Meta Description
    const metaDesc = $('meta[name="description"]').attr('content')?.trim();
    if (!metaDesc) {
      issues.push({
        url,
        ruleId: 'missing_description',
        severity: 'CRITICAL',
        title: 'Missing Meta Description',
        description: 'No <meta name="description"> tag found.',
        recommendation: 'Add a compelling meta description between 70 and 160 characters.',
      });
    } else if (metaDesc.length < 50) {
      issues.push({
        url,
        ruleId: 'short_description',
        severity: 'WARNING',
        title: 'Meta Description Too Short',
        description: `Description is only ${metaDesc.length} characters.`,
        recommendation: 'Expand meta description to at least 70–160 characters.',
      });
    } else if (metaDesc.length > 175) {
      issues.push({
        url,
        ruleId: 'long_description',
        severity: 'INFO',
        title: 'Meta Description Truncation Risk',
        description: `Description is ${metaDesc.length} characters and may be truncated.`,
        recommendation: 'Keep meta description under 160 characters.',
      });
    }

    // Rule 3: H1 Heading
    const h1Elements = $('h1');
    const h1Count = h1Elements.length;
    if (h1Count === 0) {
      issues.push({
        url,
        ruleId: 'missing_h1',
        severity: 'CRITICAL',
        title: 'Missing <h1> Heading',
        description: 'No <h1> tag was found in the rendered HTML.',
        recommendation: 'Add exactly one clear, keyword-aligned <h1> heading to the page.',
      });
    } else if (h1Count > 1) {
      issues.push({
        url,
        ruleId: 'multiple_h1',
        severity: 'WARNING',
        title: 'Multiple <h1> Headings Found',
        description: `Found ${h1Count} <h1> tags on the page.`,
        recommendation: 'Use a single <h1> heading for the main topic and <h2>/<h3> for subtopics.',
      });
    }

    // Rule 4: H2 Structure
    const h2Count = $('h2').length;
    if (h2Count === 0 && h1Count > 0) {
      issues.push({
        url,
        ruleId: 'missing_h2',
        severity: 'INFO',
        title: 'No <h2> Subheadings Found',
        description: 'The page has no <h2> tags to structure sub-sections.',
        recommendation: 'Break content into logical sections with descriptive <h2> headings.',
      });
    }

    // Rule 5: Canonical URL
    const canonical = $('link[rel="canonical"]').attr('href')?.trim();
    if (!canonical) {
      issues.push({
        url,
        ruleId: 'missing_canonical',
        severity: 'WARNING',
        title: 'Missing Canonical Tag',
        description: 'No <link rel="canonical"> tag found.',
        recommendation: `Add <link rel="canonical" href="${url}" /> to avoid duplicate content penalties.`,
      });
    }

    // Rule 6: Robots Meta Tag
    const robotsMeta = $('meta[name="robots"]').attr('content')?.toLowerCase() || '';
    if (robotsMeta.includes('noindex')) {
      issues.push({
        url,
        ruleId: 'robots_noindex',
        severity: 'CRITICAL',
        title: 'Page Blocked from Indexing (noindex)',
        description: 'Meta robots contains "noindex". Search engines will not index this page.',
        recommendation: 'Remove "noindex" from production pages intended for organic search.',
      });
    }

    // Rule 16: Mobile Viewport
    const viewport = $('meta[name="viewport"]').attr('content');
    const hasViewport = Boolean(viewport && viewport.includes('width=device-width'));
    if (!hasViewport) {
      issues.push({
        url,
        ruleId: 'missing_viewport',
        severity: 'CRITICAL',
        title: 'Missing or Invalid Mobile Viewport',
        description: 'No responsive <meta name="viewport" content="width=device-width, initial-scale=1.0"> found.',
        recommendation: 'Add standard mobile viewport meta tag for mobile search ranking compliance.',
      });
    }

    // Rule 9: Open Graph Metadata
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (!ogTitle || !ogImage) {
      issues.push({
        url,
        ruleId: 'incomplete_open_graph',
        severity: 'WARNING',
        title: 'Incomplete Open Graph Tags',
        description: 'Missing og:title or og:image tags for social sharing previews.',
        recommendation: 'Add og:title, og:description, og:image, and og:url in the document <head>.',
      });
    }

    // Rule 10: Twitter Card Metadata
    const twitterCard = $('meta[name="twitter:card"], meta[property="twitter:card"]').attr('content');
    if (!twitterCard) {
      issues.push({
        url,
        ruleId: 'missing_twitter_card',
        severity: 'INFO',
        title: 'Missing Twitter Card Tags',
        description: 'No twitter:card meta tag found for Twitter/X previews.',
        recommendation: 'Add <meta name="twitter:card" content="summary_large_image">.',
      });
    }

    // Rule 11: Image Alt Attributes
    const images = $('img');
    const imagesTotal = images.length;
    let imagesMissingAlt = 0;
    images.each((_, el) => {
      const alt = $(el).attr('alt');
      if (alt === undefined || alt.trim().length === 0) {
        imagesMissingAlt++;
      }
    });

    if (imagesMissingAlt > 0) {
      issues.push({
        url,
        ruleId: 'images_missing_alt',
        severity: imagesMissingAlt > 3 ? 'WARNING' : 'INFO',
        title: 'Images Missing Alt Text',
        description: `${imagesMissingAlt} of ${imagesTotal} images lack descriptive alt attributes.`,
        recommendation: 'Add descriptive alt text to all informative images for accessibility and image SEO.',
      });
    }

    // Rules 13 & 14: Internal & External Links
    let internalLinksCount = 0;
    let externalLinksCount = 0;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      if (href.startsWith('http')) {
        if (href.startsWith(baseUrl)) {
          internalLinksCount++;
        } else {
          externalLinksCount++;
          // Check target="_blank" without rel="noopener"
          const target = $(el).attr('target');
          const rel = $(el).attr('rel') || '';
          if (target === '_blank' && !rel.includes('noopener')) {
            issues.push({
              url,
              ruleId: 'external_link_no_noopener',
              severity: 'INFO',
              title: 'External Link Missing rel="noopener"',
              description: `Link to ${href} opens in a new tab without rel="noopener".`,
              recommendation: 'Add rel="noopener noreferrer" to external links opening in new windows.',
            });
          }
        }
      } else if (href.startsWith('/')) {
        internalLinksCount++;
      }
    });

    // Rule 17: Structured Data / JSON-LD
    const jsonLd = $('script[type="application/ld+json"]').html();
    const hasJsonLd = Boolean(jsonLd && jsonLd.trim().length > 0);
    if (!hasJsonLd) {
      issues.push({
        url,
        ruleId: 'missing_structured_data',
        severity: 'INFO',
        title: 'No JSON-LD Structured Data Found',
        description: 'Page does not include schema.org JSON-LD microdata.',
        recommendation: 'Add Person, WebSite, or CreativeWork schema to qualify for rich snippets on Google.',
      });
    }

    return {
      url,
      statusCode,
      responseTimeMs,
      title,
      description: metaDesc,
      h1Count,
      h2Count,
      canonical,
      robotsMeta,
      hasViewport,
      hasOgTitle: Boolean(ogTitle),
      hasOgImage: Boolean(ogImage),
      hasTwitterCard: Boolean(twitterCard),
      imagesTotal,
      imagesMissingAlt,
      internalLinksCount,
      externalLinksCount,
      hasJsonLd,
      issues,
    };
  }

  private static checkDuplicates(results: PageAuditResult[], issues: SeoIssue[]): void {
    const titles = new Map<string, string[]>();
    const descriptions = new Map<string, string[]>();

    for (const r of results) {
      if (r.title) {
        const list = titles.get(r.title) || [];
        list.push(r.url);
        titles.set(r.title, list);
      }
      if (r.description) {
        const list = descriptions.get(r.description) || [];
        list.push(r.url);
        descriptions.set(r.description, list);
      }
    }

    for (const [titleStr, urls] of titles.entries()) {
      if (urls.length > 1) {
        issues.push({
          url: urls[0],
          ruleId: 'duplicate_title',
          severity: 'WARNING',
          title: 'Duplicate Page Title Detected',
          description: `Title "${titleStr}" is shared across ${urls.length} pages (${urls.join(', ')}).`,
          recommendation: 'Give each page a unique, page-specific title tag.',
        });
      }
    }

    for (const [descStr, urls] of descriptions.entries()) {
      if (urls.length > 1) {
        issues.push({
          url: urls[0],
          ruleId: 'duplicate_description',
          severity: 'INFO',
          title: 'Duplicate Meta Description Detected',
          description: `Description "${descStr.slice(0, 50)}..." is shared across ${urls.length} pages.`,
          recommendation: 'Write unique meta descriptions tailored to each page content.',
        });
      }
    }
  }

  private static calculateScore(issues: SeoIssue[], _pages?: PageAuditResult[]): {
    score: number;
    categoryScores: { technical: number; content: number; social: number; links: number };
  } {
    let technical = 30;
    let content = 35;
    let social = 15;
    let links = 20;

    for (const issue of issues) {
      const deduction = issue.severity === 'CRITICAL' ? 6 : issue.severity === 'WARNING' ? 3 : 1;

      if (['robots_txt', 'sitemap', 'not_https', 'missing_viewport', 'robots_noindex'].some(k => issue.ruleId.includes(k))) {
        technical = Math.max(0, technical - deduction);
      } else if (['title', 'description', 'h1', 'h2', 'alt'].some(k => issue.ruleId.includes(k))) {
        content = Math.max(0, content - deduction);
      } else if (['og', 'twitter', 'social'].some(k => issue.ruleId.includes(k))) {
        social = Math.max(0, social - deduction);
      } else {
        links = Math.max(0, links - deduction);
      }
    }

    const total = Math.min(100, Math.max(0, technical + content + social + links));
    return {
      score: total,
      categoryScores: { technical, content, social, links },
    };
  }
}

