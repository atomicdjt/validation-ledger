import posthog from 'posthog-js';

type AnalyticsEventProperties = {
  application_loaded: { entry_point: 'direct' };
  project_created: { project_stage: string };
  source_created: { source_type: string };
  source_notes_saved: { has_content: boolean };
  manual_evidence_created: { source_type: string };
  hypothesis_created: { importance: string };
  decision_created: { confidence: string; linked_evidence_count: number; linked_hypothesis_count: number };
  backup_exported: Record<string, never>;
  backup_imported: Record<string, never>;
};

export type AnalyticsEvent = keyof AnalyticsEventProperties;
type Capture = <Event extends AnalyticsEvent>(event: Event, properties: AnalyticsEventProperties[Event]) => void;

export function createAnalytics({ key, capture }: { key?: string; capture: Capture }) {
  const once = new Set<AnalyticsEvent>();

  const track = <Event extends AnalyticsEvent>(event: Event, properties: AnalyticsEventProperties[Event]) => {
    if (!key) return;
    try {
      capture(event, properties);
    } catch {
      // Analytics is best-effort and must never affect local product use.
    }
  };

  return {
    track,
    trackOnce<Event extends AnalyticsEvent>(event: Event, properties: AnalyticsEventProperties[Event]) {
      if (once.has(event)) return;
      once.add(event);
      track(event, properties);
    },
  };
}

const publicKey = import.meta.env.VITE_POSTHOG_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export function getAnalyticsConfig(apiHost: string) {
  return {
    api_host: apiHost,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    person_profiles: 'never' as const,
    persistence: 'memory' as const,
    property_blacklist: ['$current_url', '$host', '$pathname', '$referrer', '$referring_domain'],
  };
}

export const analytics = createAnalytics({
  key: publicKey,
  capture: (event, properties) => posthog.capture(event, properties),
});

export function initializeAnalytics() {
  if (!publicKey) return;

  try {
    posthog.init(publicKey, getAnalyticsConfig(host));
    analytics.trackOnce('application_loaded', { entry_point: 'direct' });
  } catch {
    // Analytics initialization is optional and must fail open.
  }
}
