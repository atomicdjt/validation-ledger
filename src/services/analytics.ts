import posthog, { type BeforeSendFn, type CaptureResult, type Properties } from 'posthog-js';

type AnalyticsEventProperties = {
  application_loaded: { entry_point: 'direct' };
  project_created: { project_stage: 'idea' | 'discovery' | 'validation' | 'launched' };
  source_created: { source_type: 'interview' | 'email' | 'survey' | 'sales_call' | 'support' | 'observation' | 'other' };
  source_notes_saved: { has_content: boolean };
  manual_evidence_created: { source_type: 'interview' | 'email' | 'survey' | 'sales_call' | 'support' | 'observation' | 'other' };
  hypothesis_created: { importance: 'low' | 'medium' | 'high' | 'critical' };
  decision_created: { confidence: 'low' | 'moderate' | 'high'; linked_evidence_count: number; linked_hypothesis_count: number };
  backup_exported: Record<string, never>;
  backup_imported: Record<string, never>;
};

// A non-sensitive runtime marker used to distinguish a rebuilt privacy-safe
// preview from an older cached deployment during acceptance testing.
export const privacyTelemetryBuild = 'privacy-safe-v3';

export type AnalyticsEvent = keyof AnalyticsEventProperties;
type Capture = <Event extends AnalyticsEvent>(event: Event, properties: AnalyticsEventProperties[Event]) => void;

const analyticsEventPropertyKeys: Record<AnalyticsEvent, readonly string[]> = {
  application_loaded: ['entry_point'],
  project_created: ['project_stage'],
  source_created: ['source_type'],
  source_notes_saved: ['has_content'],
  manual_evidence_created: ['source_type'],
  hypothesis_created: ['importance'],
  decision_created: ['confidence', 'linked_evidence_count', 'linked_hypothesis_count'],
  backup_exported: [],
  backup_imported: [],
};

// PostHog needs these transport properties to ingest an event. Every other
// property is dropped at the last possible point before the request is sent.
const requiredTransportPropertyKeys = ['token', 'distinct_id', '$geoip_disable'] as const;

function isAnalyticsEventName(event: string): event is AnalyticsEvent {
  return Object.prototype.hasOwnProperty.call(analyticsEventPropertyKeys, event);
}

/**
 * Enforce the application's telemetry contract immediately before PostHog
 * transport. This protects against SDK-added automatic context and against a
 * future caller accidentally passing arbitrary properties to capture().
 */
export const sanitizeTelemetryEvent: BeforeSendFn = (event) => {
  if (!event || !isAnalyticsEventName(event.event)) return null;

  const source = event.properties ?? {};
  const allowedKeys = new Set<string>([
    ...requiredTransportPropertyKeys,
    ...analyticsEventPropertyKeys[event.event],
  ]);
  const properties: Properties = {};

  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      properties[key] = source[key];
    }
  }

  const sanitized: CaptureResult = {
    uuid: event.uuid,
    event: event.event,
    properties,
  };
  if (event.timestamp) sanitized.timestamp = event.timestamp;
  return sanitized;
};

function isSafeProperties<Event extends AnalyticsEvent>(event: Event, properties: AnalyticsEventProperties[Event]) {
  const value = properties as Record<string, unknown>;
  if (event === 'application_loaded') return value.entry_point === 'direct';
  if (event === 'project_created') return ['idea', 'discovery', 'validation', 'launched'].includes(value.project_stage as string);
  if (event === 'source_created' || event === 'manual_evidence_created') {
    return ['interview', 'email', 'survey', 'sales_call', 'support', 'observation', 'other'].includes(value.source_type as string);
  }
  if (event === 'hypothesis_created') return ['low', 'medium', 'high', 'critical'].includes(value.importance as string);
  if (event === 'decision_created') {
    return ['low', 'moderate', 'high'].includes(value.confidence as string)
      && Number.isInteger(value.linked_evidence_count) && (value.linked_evidence_count as number) >= 0
      && Number.isInteger(value.linked_hypothesis_count) && (value.linked_hypothesis_count as number) >= 0;
  }
  if (event === 'source_notes_saved') return typeof value.has_content === 'boolean';
  return true;
}

export function createAnalytics({ key, capture }: { key?: string; capture: Capture }) {
  const once = new Set<AnalyticsEvent>();

  const track = <Event extends AnalyticsEvent>(event: Event, properties: AnalyticsEventProperties[Event]) => {
    if (!key || !isSafeProperties(event, properties)) return false;
    try {
      capture(event, properties);
      return true;
    } catch {
      // Analytics is best-effort and must never affect local product use.
      return false;
    }
  };

  return {
    track,
    trackOnce<Event extends AnalyticsEvent>(event: Event, properties: AnalyticsEventProperties[Event]) {
      if (once.has(event)) return;
      if (track(event, properties)) once.add(event);
    },
  };
}

const publicKey = import.meta.env.VITE_POSTHOG_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST === 'https://us.i.posthog.com' ? import.meta.env.VITE_POSTHOG_HOST : 'https://us.i.posthog.com';

export function getAnalyticsConfig(apiHost: string) {
  return {
    api_host: apiHost === 'https://us.i.posthog.com' ? apiHost : 'https://us.i.posthog.com',
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    person_profiles: 'never' as const,
    persistence: 'memory' as const,
    before_send: sanitizeTelemetryEvent,
    property_blacklist: [
      '$current_url',
      '$host',
      '$pathname',
      '$referrer',
      '$referring_domain',
      '$raw_user_agent',
      '$browser',
      '$browser_language',
      '$browser_language_prefix',
      '$device_type',
      '$os',
      '$os_version',
      '$screen_height',
      '$screen_width',
      '$viewport_height',
      '$viewport_width',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'gclid',
      'fbclid',
      'msclkid',
      'ttclid',
      'dclid',
      'gbraid',
      'wbraid',
      'li_fat_id',
      'mc_cid',
      'mc_eid',
    ],
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_heatmaps: false,
    capture_performance: false,
    on_request_error: (response: { statusCode?: number; error?: unknown }) => {
      const detail = response.error instanceof Error ? response.error.message : typeof response.error === 'string' ? response.error : 'unknown';
      console.warn('[telemetry] PostHog request failed', response.statusCode ?? 'unknown', detail);
    },
  };
}

export const analytics = createAnalytics({
  key: publicKey,
  capture: (event, properties) => posthog.capture(event, { ...properties, $geoip_disable: true }),
});

type AnalyticsClient = {
  init: (key: string, config: ReturnType<typeof getAnalyticsConfig>) => void;
  capture: Capture;
  on?: (event: string, callback: (data: { event: string }) => void) => void;
};

export function initializeAnalytics({ key = publicKey, apiHost = host, client = posthog as AnalyticsClient }: { key?: string; apiHost?: string; client?: AnalyticsClient } = {}) {
  if (!key) return;

  try {
    client.init(key, getAnalyticsConfig(apiHost));
    client.on?.('eventCaptured', ({ event }) => console.info('[telemetry] captured', event));
    const tracker = client === posthog ? analytics : createAnalytics({ key, capture: (event, properties) => client.capture(event, { ...properties, $geoip_disable: true }) });
    tracker.trackOnce('application_loaded', { entry_point: 'direct' });
  } catch {
    // Analytics initialization is optional and must fail open.
  }
}
