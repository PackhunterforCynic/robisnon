/**
 * Google Search Console Integration
 * Uses official Google APIs via googleapis library.
 * Secure Service Account or OAuth credentials.
 */

import { google } from 'googleapis';
import { config } from './config';
import { query } from './db';

export interface GscOverviewMetrics {
  configured: boolean;
  startDate: string;
  endDate: string;
  daysRange: number;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  topPages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
  countries: Array<{ country: string; clicks: number; impressions: number }>;
  devices: Array<{ device: string; clicks: number; impressions: number }>;
  previousPeriod?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
}

export class SearchConsoleService {
  /**
   * Get an authorized Google Search Console client
   */
  private static getClient() {
    let auth;

    if (config.googleCredentialsJson) {
      try {
        const credentials = JSON.parse(config.googleCredentialsJson);
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
        });
      } catch (err: any) {
        console.error('[GSC] Error parsing GOOGLE_APPLICATION_CREDENTIALS_JSON:', err.message);
      }
    }

    if (!auth && config.googleClientEmail && config.googlePrivateKey) {
      auth = new google.auth.JWT({
        email: config.googleClientEmail,
        key: config.googlePrivateKey,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });
    }

    if (!auth) {
      return null;
    }

    return google.webmasters({ version: 'v3', auth });
  }

  /**
   * Check if GSC credentials are configured in environment
   */
  static isConfigured(): boolean {
    return Boolean(
      config.googleCredentialsJson ||
      (config.googleClientEmail && config.googlePrivateKey)
    );
  }

  /**
   * Fetch Search Performance from Google Search Console for a given date range (7, 28, or 90 days)
   */
  static async getPerformance(daysRange = 28): Promise<GscOverviewMetrics> {
    const isConfig = this.isConfigured();
    if (!isConfig) {
      return {
        configured: false,
        startDate: '',
        endDate: '',
        daysRange,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        topQueries: [],
        topPages: [],
        countries: [],
        devices: [],
      };
    }

    const client = this.getClient();
    if (!client) {
      return {
        configured: false,
        startDate: '',
        endDate: '',
        daysRange,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        topQueries: [],
        topPages: [],
        countries: [],
        devices: [],
      };
    }

    const endDateObj = new Date();
    // GSC data usually has a 2-3 day lag
    endDateObj.setDate(endDateObj.getDate() - 2);
    const startDateObj = new Date(endDateObj);
    startDateObj.setDate(startDateObj.getDate() - daysRange);

    const endDateStr = endDateObj.toISOString().split('T')[0];
    const startDateStr = startDateObj.toISOString().split('T')[0];

    try {
      const siteUrl = config.gscSiteUrl;

      // 1. Fetch Top Queries
      const queryRes = await client.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['query'],
          rowLimit: 10,
        },
      });

      // 2. Fetch Top Pages
      const pageRes = await client.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['page'],
          rowLimit: 10,
        },
      });

      // 3. Fetch Device distribution
      const deviceRes = await client.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['device'],
        },
      });

      // 4. Fetch Country breakdown
      const countryRes = await client.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['country'],
          rowLimit: 10,
        },
      });

      // Aggregate totals from queries
      const queryRows = queryRes.data.rows || [];
      const totalClicks = queryRows.reduce((sum, r) => sum + (r.clicks || 0), 0);
      const totalImpressions = queryRows.reduce((sum, r) => sum + (r.impressions || 0), 0);
      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const avgPos = queryRows.length > 0 ? queryRows.reduce((sum, r) => sum + (r.position || 0), 0) / queryRows.length : 0;

      const topQueries = queryRows.map(r => ({
        query: r.keys?.[0] || 'Unknown',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: parseFloat(((r.ctr || 0) * 100).toFixed(2)),
        position: parseFloat((r.position || 0).toFixed(1)),
      }));

      const topPages = (pageRes.data.rows || []).map(r => ({
        page: r.keys?.[0] || '/',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: parseFloat(((r.ctr || 0) * 100).toFixed(2)),
        position: parseFloat((r.position || 0).toFixed(1)),
      }));

      const devices = (deviceRes.data.rows || []).map(r => ({
        device: r.keys?.[0] || 'DESKTOP',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
      }));

      const countries = (countryRes.data.rows || []).map(r => ({
        country: r.keys?.[0] || 'Unknown',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
      }));

      // Cache snapshot into database
      try {
        await query(
          `INSERT INTO search_console_metrics (
            site_url, start_date, end_date, days_range, clicks, impressions, ctr, position,
            top_queries_json, top_pages_json, countries_json, devices_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            siteUrl,
            startDateStr,
            endDateStr,
            daysRange,
            totalClicks,
            totalImpressions,
            parseFloat((avgCtr / 100).toFixed(4)),
            parseFloat(avgPos.toFixed(2)),
            JSON.stringify(topQueries),
            JSON.stringify(topPages),
            JSON.stringify(countries),
            JSON.stringify(devices),
          ]
        );
      } catch (cacheErr: any) {
        console.error('[GSC] Failed to cache GSC metrics to DB:', cacheErr.message);
      }

      return {
        configured: true,
        startDate: startDateStr,
        endDate: endDateStr,
        daysRange,
        clicks: totalClicks,
        impressions: totalImpressions,
        ctr: parseFloat(avgCtr.toFixed(2)),
        position: parseFloat(avgPos.toFixed(1)),
        topQueries,
        topPages,
        countries,
        devices,
      };
    } catch (err: any) {
      console.error('[GSC] Google Search Console API query error:', err.message);
      throw err;
    }
  }
}
