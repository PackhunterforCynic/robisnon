/**
 * Robinson Portfolio - Lightweight Privacy-First Website Visitor Tracker
 * Zero PII | No invasive fingerprinting | First-party storage | Respects Do-Not-Track
 */
(function () {
  'use strict';

  // Check Opt-Out & Do Not Track
  if (
    typeof window === 'undefined' ||
    navigator.doNotTrack === '1' ||
    window.doNotTrack === '1' ||
    navigator.msDoNotTrack === '1' ||
    localStorage.getItem('analytics_opt_out') === 'true'
  ) {
    return;
  }

  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  var ENDPOINT = '/api/track';

  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // 1. Visitor ID (Persistent anonymous identifier)
  function getVisitorId() {
    var vid = localStorage.getItem('r_vid');
    if (!vid) {
      vid = 'v_' + generateUUID();
      try {
        localStorage.setItem('r_vid', vid);
      } catch (e) {}
    }
    return vid;
  }

  // 2. Session ID (Expires after 30 mins of inactivity)
  function getSessionInfo() {
    var now = Date.now();
    var sid = sessionStorage.getItem('r_sid');
    var lastActive = parseInt(sessionStorage.getItem('r_s_last') || '0', 10);
    var isNewSession = false;

    if (!sid || now - lastActive > SESSION_TIMEOUT_MS) {
      sid = 's_' + generateUUID();
      isNewSession = true;
      try {
        sessionStorage.setItem('r_sid', sid);
        sessionStorage.setItem('r_s_start', now.toString());
      } catch (e) {}
    }

    try {
      sessionStorage.setItem('r_s_last', now.toString());
    } catch (e) {}

    var startTime = parseInt(sessionStorage.getItem('r_s_start') || now.toString(), 10);
    var durationSeconds = Math.max(0, Math.floor((now - startTime) / 1000));

    return {
      sessionId: sid,
      isNewSession: isNewSession,
      durationSeconds: durationSeconds,
    };
  }

  // 3. Device, Browser, and OS Detection (Non-invasive)
  function getClientEnvironment() {
    var ua = navigator.userAgent || '';
    var width = window.innerWidth || screen.width || 0;
    var height = window.innerHeight || screen.height || 0;

    // Device Category
    var deviceCategory = 'desktop';
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      deviceCategory = 'tablet';
    } else if (
      /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(
        ua
      ) ||
      width < 768
    ) {
      deviceCategory = 'mobile';
    }

    // Browser
    var browser = 'Other';
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome|crios/i.test(ua) && !/opr|opera/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/opr|opera/i.test(ua)) browser = 'Opera';

    // OS
    var os = 'Other';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/linux/i.test(ua)) os = 'Linux';

    return {
      deviceCategory: deviceCategory,
      browser: browser,
      os: os,
      screenWidth: width,
      screenHeight: height,
    };
  }

  // 4. UTM Parameters
  function getUTMParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
    };
  }

  // 5. Send Event Payload
  function sendEvent(eventType, eventName, metadata) {
    try {
      var session = getSessionInfo();
      var visitorId = getVisitorId();
      var env = getClientEnvironment();
      var utm = getUTMParams();

      var payload = {
        sessionId: session.sessionId,
        visitorId: visitorId,
        eventType: eventType || 'pageview',
        eventName: eventName || 'pageview',
        url: window.location.href,
        path: window.location.pathname || '/',
        title: document.title,
        referrer: document.referrer || '',
        utmSource: utm.utmSource,
        utmMedium: utm.utmMedium,
        utmCampaign: utm.utmCampaign,
        deviceCategory: env.deviceCategory,
        browser: env.browser,
        os: env.os,
        screenWidth: env.screenWidth,
        screenHeight: env.screenHeight,
        durationSeconds: session.durationSeconds,
        isNewSession: session.isNewSession,
        metadata: metadata || {},
      };

      var dataStr = JSON.stringify(payload);

      // Prefer sendBeacon for exit beacons, fetch with keepalive for standard
      if (eventType === 'exit' && navigator.sendBeacon) {
        var blob = new Blob([dataStr], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT, blob);
      } else {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: dataStr,
          keepalive: true,
        }).catch(function () {});
      }
    } catch (e) {
      // Fail silently to never impact user experience
    }
  }

  // Public API exposed on window
  window.PortfolioTracker = {
    trackPageView: function (customPath, customTitle) {
      sendEvent('pageview', 'pageview', { path: customPath, title: customTitle });
    },
    trackEvent: function (eventName, metadata) {
      sendEvent('custom', eventName, metadata);
    },
    optOut: function () {
      localStorage.setItem('analytics_opt_out', 'true');
      console.log('Portfolio Analytics: Opted out.');
    },
    optIn: function () {
      localStorage.removeItem('analytics_opt_out');
      console.log('Portfolio Analytics: Opted in.');
    },
  };

  // Initial Page View
  var lastTrackedPath = window.location.pathname;
  sendEvent('pageview', 'pageview');

  // SPA Route Change Listener (monkey-patch history API)
  var origPushState = history.pushState;
  if (origPushState) {
    history.pushState = function () {
      origPushState.apply(this, arguments);
      setTimeout(function () {
        if (window.location.pathname !== lastTrackedPath) {
          lastTrackedPath = window.location.pathname;
          sendEvent('pageview', 'pageview');
        }
      }, 50);
    };
  }

  window.addEventListener('popstate', function () {
    if (window.location.pathname !== lastTrackedPath) {
      lastTrackedPath = window.location.pathname;
      sendEvent('pageview', 'pageview');
    }
  });

  // Exit beacon on unload
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      sendEvent('exit', 'session_exit');
    }
  });
})();

