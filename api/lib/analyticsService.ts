/**
 * Analytics Service
 * High-performance database aggregation queries for Telegram bot reports & dashboard.
 */

import { query } from './db';
import { appConfig } from './config';
import { JsonAnalyticsStore } from './jsonStore';

export interface OverviewMetrics {
  totalVisitors: number;
  totalPageViews: number;
  newSessions: number;
  returningSessions: number;
  avgDurationSeconds: number;
  avgPagesPerSession: number;
}

export interface PageStat {
  path: string;
  views: number;
  uniqueVisitors: number;
}

export interface ReferrerStat {
  domain: string;
  count: number;
  percentage: number;
}

export interface DeviceStat {
  device: string;
  count: number;
  percentage: number;
}

export interface CountryStat {
  country: string;
  count: number;
  percentage: number;
}

export interface RealtimeActivity {
  activeSessions30m: number;
  pageViews30m: number;
  recentSessions: Array<{
    path: string;
    device: string;
    country: string;
    minutesAgo: number;
  }>;
}

export class AnalyticsService {
  /**
   * Get metrics for a specific interval (e.g. 'today', 'yesterday', '7_days', '30_days', 'all_time')
   */
  static async getMetricsForPeriod(period: 'today' | 'yesterday' | '7_days' | '30_days' | 'all_time'): Promise<OverviewMetrics> {
    if (!appConfig.databaseUrl) {
      return JsonAnalyticsStore.getMetrics(period);
    }
    let whereClause = '';

    if (period === 'today') {
      whereClause = `WHERE started_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')`;
    } else if (period === 'yesterday') {
      whereClause = `WHERE started_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day'
                     AND started_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')`;
    } else if (period === '7_days') {
      whereClause = `WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '7 days'`;
    } else if (period === '30_days') {
      whereClause = `WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '30 days'`;
    }

    const sql = `
      SELECT
        COUNT(DISTINCT visitor_id)::int AS total_visitors,
        COALESCE(SUM(page_views_count), 0)::int AS total_page_views,
        COUNT(CASE WHEN is_returning = false THEN 1 END)::int AS new_sessions,
        COUNT(CASE WHEN is_returning = true THEN 1 END)::int AS returning_sessions,
        COALESCE(AVG(duration_seconds), 0)::int AS avg_duration,
        COALESCE(AVG(page_views_count), 0)::numeric(4,1) AS avg_pages_per_session
      FROM visitor_sessions
      ${whereClause}
    `;

    try {
      const res = await query(sql);
      const row = res.rows[0] || {};
      return {
        totalVisitors: row.total_visitors || 0,
        totalPageViews: row.total_page_views || 0,
        newSessions: row.new_sessions || 0,
        returningSessions: row.returning_sessions || 0,
        avgDurationSeconds: row.avg_duration || 0,
        avgPagesPerSession: parseFloat(row.avg_pages_per_session || '1.0'),
      };
    } catch (err: any) {
      console.error('[AnalyticsService] Error fetching period metrics:', err.message);
      return {
        totalVisitors: 0,
        totalPageViews: 0,
        newSessions: 0,
        returningSessions: 0,
        avgDurationSeconds: 0,
        avgPagesPerSession: 0,
      };
    }
  }

  /**
   * Get most popular pages
   */
  static async getTopPages(limit = 10, offset = 0, periodDays = 30): Promise<{ pages: PageStat[]; total: number }> {
    if (!appConfig.databaseUrl) {
      return JsonAnalyticsStore.getTopPages(limit, offset);
    }
    try {
      const countRes = await query(`
        SELECT COUNT(DISTINCT path)::int AS total
        FROM page_views
        WHERE created_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
      `, [periodDays]);
      const total = countRes.rows[0]?.total || 0;

      const sql = `
        SELECT
          path,
          COUNT(*)::int AS views,
          COUNT(DISTINCT session_id)::int AS unique_visitors
        FROM page_views
        WHERE created_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
        GROUP BY path
        ORDER BY views DESC
        LIMIT $2 OFFSET $3
      `;
      const res = await query(sql, [periodDays, limit, offset]);
      return {
        pages: res.rows.map(r => ({
          path: r.path,
          views: r.views,
          uniqueVisitors: r.unique_visitors,
        })),
        total,
      };
    } catch (err: any) {
      console.error('[AnalyticsService] Error fetching top pages:', err.message);
      return { pages: [], total: 0 };
    }
  }

  /**
   * Get traffic sources & referrers
   */
  static async getReferrers(limit = 10, offset = 0, periodDays = 30): Promise<{ referrers: ReferrerStat[]; total: number }> {
    if (!appConfig.databaseUrl) {
      return JsonAnalyticsStore.getReferrers(limit, offset);
    }
    try {
      const countRes = await query(`
        SELECT COUNT(DISTINCT COALESCE(referrer_domain, 'Direct'))::int AS total
        FROM visitor_sessions
        WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
      `, [periodDays]);
      const total = countRes.rows[0]?.total || 0;

      const sql = `
        WITH source_counts AS (
          SELECT
            COALESCE(referrer_domain, 'Direct') AS domain,
            COUNT(*)::int AS count
          FROM visitor_sessions
          WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
          GROUP BY COALESCE(referrer_domain, 'Direct')
        ),
        total_sum AS (
          SELECT NULLIF(SUM(count), 0)::float AS total_count FROM source_counts
        )
        SELECT
          s.domain,
          s.count,
          ROUND(((s.count / t.total_count) * 100)::numeric, 1)::float AS percentage
        FROM source_counts s, total_sum t
        ORDER BY s.count DESC
        LIMIT $2 OFFSET $3
      `;
      const res = await query(sql, [periodDays, limit, offset]);
      return {
        referrers: res.rows.map(r => ({
          domain: r.domain,
          count: r.count,
          percentage: r.percentage || 0,
        })),
        total,
      };
    } catch (err: any) {
      console.error('[AnalyticsService] Error fetching referrers:', err.message);
      return { referrers: [], total: 0 };
    }
  }

  /**
   * Device distribution
   */
  static async getDevices(periodDays = 30): Promise<DeviceStat[]> {
    if (!appConfig.databaseUrl) {
      return JsonAnalyticsStore.getDevices();
    }
    try {
      const sql = `
        WITH dev_counts AS (
          SELECT
            device_category AS device,
            COUNT(*)::int AS count
          FROM visitor_sessions
          WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
          GROUP BY device_category
        ),
        total_sum AS (
          SELECT NULLIF(SUM(count), 0)::float AS total_count FROM dev_counts
        )
        SELECT
          d.device,
          d.count,
          ROUND(((d.count / t.total_count) * 100)::numeric, 1)::float AS percentage
        FROM dev_counts d, total_sum t
        ORDER BY d.count DESC
      `;
      const res = await query(sql, [periodDays]);
      return res.rows.map(r => ({
        device: r.device || 'desktop',
        count: r.count,
        percentage: r.percentage || 0,
      }));
    } catch (err: any) {
      console.error('[AnalyticsService] Error fetching devices:', err.message);
      return [];
    }
  }

  /**
   * Country distribution
   */
  static async getCountries(limit = 10, offset = 0, periodDays = 30): Promise<{ countries: CountryStat[]; total: number }> {
    if (!appConfig.databaseUrl) {
      return JsonAnalyticsStore.getCountries(limit, offset);
    }
    try {
      const countRes = await query(`
        SELECT COUNT(DISTINCT country)::int AS total
        FROM visitor_sessions
        WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
      `, [periodDays]);
      const total = countRes.rows[0]?.total || 0;

      const sql = `
        WITH c_counts AS (
          SELECT
            country,
            COUNT(*)::int AS count
          FROM visitor_sessions
          WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
          GROUP BY country
        ),
        total_sum AS (
          SELECT NULLIF(SUM(count), 0)::float AS total_count FROM c_counts
        )
        SELECT
          c.country,
          c.count,
          ROUND(((c.count / t.total_count) * 100)::numeric, 1)::float AS percentage
        FROM c_counts c, total_sum t
        ORDER BY c.count DESC
        LIMIT $2 OFFSET $3
      `;
      const res = await query(sql, [periodDays, limit, offset]);
      return {
        countries: res.rows.map(r => ({
          country: r.country || 'XX',
          count: r.count,
          percentage: r.percentage || 0,
        })),
        total,
      };
    } catch (err: any) {
      console.error('[AnalyticsService] Error fetching countries:', err.message);
      return { countries: [], total: 0 };
    }
  }

  /**
   * Realtime activity (last 30 minutes)
   */
  static async getRealtime(): Promise<RealtimeActivity> {
    if (!appConfig.databaseUrl) {
      return JsonAnalyticsStore.getRealtime();
    }
    try {
      const statsRes = await query(`
        SELECT
          COUNT(DISTINCT session_id)::int AS active_sessions,
          COALESCE(SUM(page_views_count), 0)::int AS page_views
        FROM visitor_sessions
        WHERE last_activity_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '30 minutes'
      `);

      const recentRes = await query(`
        SELECT
          landing_page AS path,
          device_category AS device,
          country,
          ROUND(EXTRACT(EPOCH FROM (NOW() AT TIME ZONE 'UTC' - last_activity_at)) / 60)::int AS minutes_ago
        FROM visitor_sessions
        WHERE last_activity_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '24 hours'
        ORDER BY last_activity_at DESC
        LIMIT 8
      `);

      return {
        activeSessions30m: statsRes.rows[0]?.active_sessions || 0,
        pageViews30m: statsRes.rows[0]?.page_views || 0,
        recentSessions: recentRes.rows.map(r => ({
          path: r.path || '/',
          device: r.device || 'desktop',
          country: r.country || 'XX',
          minutesAgo: Math.max(0, r.minutes_ago || 0),
        })),
      };
    } catch (err: any) {
      console.error('[AnalyticsService] Error fetching realtime activity:', err.message);
      return { activeSessions30m: 0, pageViews30m: 0, recentSessions: [] };
    }
  }
}

