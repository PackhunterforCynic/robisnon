/**
 * In-Memory & File-Based Analytics Store
 * Stores visitor events, sessions, and aggregates without requiring any SQL database.
 * Uses /tmp/analytics.json on serverless instances and syncs live events to Telegram.
 */

import fs from 'fs';
import path from 'path';

export interface StoredSession {
  sessionId: string;
  visitorId: string;
  isReturning: boolean;
  landingPage: string;
  exitPage: string;
  pageViewsCount: number;
  durationSeconds: number;
  deviceCategory: string;
  browser: string;
  os: string;
  country: string;
  referrer: string;
  referrerDomain: string;
  utmSource?: string;
  startedAt: string; // ISO string
  lastActivityAt: string;
}

export interface StoredPageView {
  path: string;
  title?: string;
  timestamp: string;
  sessionId: string;
}

export interface AnalyticsMemoryStore {
  totalVisitorsCount: number;
  totalPageViewsCount: number;
  sessions: StoredSession[];
  pageViews: StoredPageView[];
  lastSavedAt: string;
}

const STORAGE_FILE = path.join('/tmp', 'portfolio_analytics.json');
const MAX_SESSIONS = 500;
const MAX_PAGEVIEWS = 1000;

// Singleton in-memory state across warm serverless invocations
let memoryStore: AnalyticsMemoryStore = {
  totalVisitorsCount: 0,
  totalPageViewsCount: 0,
  sessions: [],
  pageViews: [],
  lastSavedAt: new Date().toISOString(),
};

// Try to hydrate from /tmp if available
try {
  if (fs.existsSync(STORAGE_FILE)) {
    const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      memoryStore = {
        totalVisitorsCount: parsed.totalVisitorsCount || 0,
        totalPageViewsCount: parsed.totalPageViewsCount || 0,
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        pageViews: Array.isArray(parsed.pageViews) ? parsed.pageViews : [],
        lastSavedAt: parsed.lastSavedAt || new Date().toISOString(),
      };
    }
  }
} catch {
  // Gracefully fallback to memory
}

function persistToDisk() {
  try {
    memoryStore.lastSavedAt = new Date().toISOString();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(memoryStore));
  } catch {
    // Non-fatal if /tmp write fails
  }
}

export class JsonAnalyticsStore {
  /**
   * Record a new or existing visitor session and pageview
   */
  static recordEvent(payload: {
    sessionId: string;
    visitorId: string;
    path: string;
    title?: string;
    referrer?: string;
    referrerDomain?: string;
    deviceCategory?: string;
    browser?: string;
    os?: string;
    country?: string;
    utmSource?: string;
    durationSeconds?: number;
  }): { isNewSession: boolean; isReturningVisitor: boolean } {
    const nowIso = new Date().toISOString();
    let isNewSession = false;

    let existingSession = memoryStore.sessions.find(s => s.sessionId === payload.sessionId);

    const isReturningVisitor = memoryStore.sessions.some(
      s => s.visitorId === payload.visitorId && s.sessionId !== payload.sessionId
    );

    if (!existingSession) {
      isNewSession = true;
      existingSession = {
        sessionId: payload.sessionId,
        visitorId: payload.visitorId,
        isReturning: isReturningVisitor,
        landingPage: payload.path,
        exitPage: payload.path,
        pageViewsCount: 1,
        durationSeconds: payload.durationSeconds || 0,
        deviceCategory: payload.deviceCategory || 'desktop',
        browser: payload.browser || 'Unknown',
        os: payload.os || 'Unknown',
        country: payload.country || 'XX',
        referrer: payload.referrer || 'Direct',
        referrerDomain: payload.referrerDomain || 'Direct',
        utmSource: payload.utmSource,
        startedAt: nowIso,
        lastActivityAt: nowIso,
      };

      memoryStore.sessions.unshift(existingSession);
      memoryStore.totalVisitorsCount++;

      if (memoryStore.sessions.length > MAX_SESSIONS) {
        memoryStore.sessions.pop();
      }
    } else {
      existingSession.lastActivityAt = nowIso;
      existingSession.exitPage = payload.path;
      existingSession.pageViewsCount++;
      if (payload.durationSeconds) {
        existingSession.durationSeconds = Math.max(existingSession.durationSeconds, payload.durationSeconds);
      }
    }

    // Record PageView
    memoryStore.totalPageViewsCount++;
    memoryStore.pageViews.unshift({
      path: payload.path,
      title: payload.title,
      timestamp: nowIso,
      sessionId: payload.sessionId,
    });

    if (memoryStore.pageViews.length > MAX_PAGEVIEWS) {
      memoryStore.pageViews.pop();
    }

    persistToDisk();

    return { isNewSession, isReturningVisitor };
  }

  /**
   * Get overall metrics for period
   */
  static getMetrics(period: 'today' | 'yesterday' | '7_days' | '30_days' | 'all_time') {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    let filtered = memoryStore.sessions;

    if (period === 'today') {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      filtered = memoryStore.sessions.filter(s => new Date(s.startedAt).getTime() >= todayStart.getTime());
    } else if (period === 'yesterday') {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart.getTime() - oneDay);
      filtered = memoryStore.sessions.filter(s => {
        const t = new Date(s.startedAt).getTime();
        return t >= yesterdayStart.getTime() && t < todayStart.getTime();
      });
    } else if (period === '7_days') {
      filtered = memoryStore.sessions.filter(s => now - new Date(s.startedAt).getTime() <= 7 * oneDay);
    } else if (period === '30_days') {
      filtered = memoryStore.sessions.filter(s => now - new Date(s.startedAt).getTime() <= 30 * oneDay);
    }

    const totalVisitors = new Set(filtered.map(s => s.visitorId)).size;
    const totalPageViews = filtered.reduce((acc, s) => acc + s.pageViewsCount, 0);
    const newSessions = filtered.filter(s => !s.isReturning).length;
    const returningSessions = filtered.filter(s => s.isReturning).length;
    const avgDurationSeconds = filtered.length > 0
      ? Math.round(filtered.reduce((acc, s) => acc + s.durationSeconds, 0) / filtered.length)
      : 0;
    const avgPagesPerSession = filtered.length > 0
      ? parseFloat((totalPageViews / filtered.length).toFixed(1))
      : 1.0;

    return {
      totalVisitors: period === 'all_time' ? Math.max(totalVisitors, memoryStore.totalVisitorsCount) : totalVisitors,
      totalPageViews: period === 'all_time' ? Math.max(totalPageViews, memoryStore.totalPageViewsCount) : totalPageViews,
      newSessions,
      returningSessions,
      avgDurationSeconds,
      avgPagesPerSession,
    };
  }

  /**
   * Get Top Pages
   */
  static getTopPages(limit = 10, offset = 0) {
    const counts = new Map<string, { views: number; uniqueVisitors: Set<string> }>();

    for (const pv of memoryStore.pageViews) {
      const existing = counts.get(pv.path) || { views: 0, uniqueVisitors: new Set() };
      existing.views++;
      existing.uniqueVisitors.add(pv.sessionId);
      counts.set(pv.path, existing);
    }

    const sorted = Array.from(counts.entries())
      .map(([path, data]) => ({
        path,
        views: data.views,
        uniqueVisitors: data.uniqueVisitors.size,
      }))
      .sort((a, b) => b.views - a.views);

    return {
      pages: sorted.slice(offset, offset + limit),
      total: sorted.length,
    };
  }

  /**
   * Get Referrers
   */
  static getReferrers(limit = 10, offset = 0) {
    const counts = new Map<string, number>();

    for (const s of memoryStore.sessions) {
      const domain = s.referrerDomain || 'Direct';
      counts.set(domain, (counts.get(domain) || 0) + 1);
    }

    const total = memoryStore.sessions.length || 1;
    const sorted = Array.from(counts.entries())
      .map(([domain, count]) => ({
        domain,
        count,
        percentage: parseFloat(((count / total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      referrers: sorted.slice(offset, offset + limit),
      total: sorted.length,
    };
  }

  /**
   * Get Devices
   */
  static getDevices() {
    const counts = new Map<string, number>();
    for (const s of memoryStore.sessions) {
      counts.set(s.deviceCategory, (counts.get(s.deviceCategory) || 0) + 1);
    }
    const total = memoryStore.sessions.length || 1;
    return Array.from(counts.entries()).map(([device, count]) => ({
      device,
      count,
      percentage: parseFloat(((count / total) * 100).toFixed(1)),
    }));
  }

  /**
   * Get Countries
   */
  static getCountries(limit = 10, offset = 0) {
    const counts = new Map<string, number>();
    for (const s of memoryStore.sessions) {
      counts.set(s.country, (counts.get(s.country) || 0) + 1);
    }
    const total = memoryStore.sessions.length || 1;
    const sorted = Array.from(counts.entries())
      .map(([country, count]) => ({
        country,
        count,
        percentage: parseFloat(((count / total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      countries: sorted.slice(offset, offset + limit),
      total: sorted.length,
    };
  }

  /**
   * Get Realtime Activity
   */
  static getRealtime() {
    const now = Date.now();
    const halfHour = 30 * 60 * 1000;

    const activeSessions = memoryStore.sessions.filter(
      s => now - new Date(s.lastActivityAt).getTime() <= halfHour
    );

    const recentSessions = memoryStore.sessions.slice(0, 8).map(s => ({
      path: s.exitPage || s.landingPage || '/',
      device: s.deviceCategory || 'desktop',
      country: s.country || 'XX',
      minutesAgo: Math.max(0, Math.round((now - new Date(s.lastActivityAt).getTime()) / 60000)),
    }));

    return {
      activeSessions30m: activeSessions.length,
      pageViews30m: activeSessions.reduce((acc, s) => acc + s.pageViewsCount, 0),
      recentSessions,
    };
  }
}

