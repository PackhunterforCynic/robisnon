/**
 * React Integration for Portfolio Analytics
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    PortfolioTracker?: {
      trackPageView: (customPath?: string, customTitle?: string) => void;
      trackEvent: (eventName: string, metadata?: Record<string, any>) => void;
      optOut: () => void;
      optIn: () => void;
    };
  }
}

/**
 * Hook to automatically record SPA pageviews on React Router route changes
 */
export function usePageTracking(): void {
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.PortfolioTracker) {
      window.PortfolioTracker.trackPageView(location.pathname + location.search, document.title);
    }
  }, [location]);
}

/**
 * Dispatch a custom event (e.g., project clicks, contact clicks)
 */
export function trackCustomEvent(eventName: string, metadata?: Record<string, any>): void {
  if (typeof window !== 'undefined' && window.PortfolioTracker) {
    window.PortfolioTracker.trackEvent(eventName, metadata);
  }
}

