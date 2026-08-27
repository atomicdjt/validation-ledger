import { describe, expect, it, vi } from 'vitest';
import { createAnalytics, getAnalyticsConfig, initializeAnalytics, sanitizeTelemetryEvent } from './analytics';

describe('privacy-safe analytics', () => {
  it('does nothing when the public PostHog key is absent', () => {
    const capture = vi.fn();
    const analytics = createAnalytics({ key: undefined, capture });

    analytics.track('project_created', { project_stage: 'idea' });

    expect(capture).not.toHaveBeenCalled();
  });

  it('sends only the allowlisted structural properties for a product event', () => {
    const capture = vi.fn();
    const analytics = createAnalytics({ key: 'phc_test', capture });

    analytics.track('source_created', { source_type: 'interview' });

    expect(capture).toHaveBeenCalledWith('source_created', { source_type: 'interview' });
  });

  it('rejects arbitrary values at runtime before capture', () => {
    const capture = vi.fn();
    const analytics = createAnalytics({ key: 'phc_test', capture });

    analytics.track('source_created', { source_type: 'https://private.example' } as never);

    expect(capture).not.toHaveBeenCalled();
  });

  it('records an application load once even if initialization runs twice', () => {
    const capture = vi.fn();
    const analytics = createAnalytics({ key: 'phc_test', capture });

    analytics.trackOnce('application_loaded', { entry_point: 'direct' });
    analytics.trackOnce('application_loaded', { entry_point: 'direct' });

    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('fails open when the analytics provider throws', () => {
    const analytics = createAnalytics({ key: 'phc_test', capture: () => { throw new Error('provider unavailable'); } });

    expect(() => analytics.track('backup_exported', {})).not.toThrow();
  });

  it('allows a once-only event to retry after a failed capture', () => {
    const capture = vi.fn().mockImplementationOnce(() => { throw new Error('temporary'); });
    const analytics = createAnalytics({ key: 'phc_test', capture });

    analytics.trackOnce('application_loaded', { entry_point: 'direct' });
    analytics.trackOnce('application_loaded', { entry_point: 'direct' });

    expect(capture).toHaveBeenCalledTimes(2);
  });

  it('initializes with every privacy control enabled', () => {
    const client = { init: vi.fn(), capture: vi.fn() };

    initializeAnalytics({ key: 'phc_test', apiHost: 'https://us.i.posthog.com', client });

    expect(client.init).toHaveBeenCalledWith('phc_test', expect.objectContaining({
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      person_profiles: 'never',
      persistence: 'memory',
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_heatmaps: false,
      capture_performance: false,
      before_send: sanitizeTelemetryEvent,
      property_blacklist: expect.arrayContaining(['$current_url', '$raw_user_agent', '$browser', '$os']),
    }));
    expect(client.capture).toHaveBeenCalledWith('application_loaded', { entry_point: 'direct', $geoip_disable: true });
  });

  it('skips initialization without a public key', () => {
    const client = { init: vi.fn(), capture: vi.fn() };

    initializeAnalytics({ key: undefined, client });

    expect(client.init).not.toHaveBeenCalled();
  });

  it('blacklists automatic URL context from every captured event', () => {
    const config = getAnalyticsConfig('https://us.i.posthog.com');
    expect(config.property_blacklist).toContain('$current_url');
    expect(config.property_blacklist).toContain('$raw_user_agent');
  });

  it('strips SDK-added context and arbitrary properties at the transport boundary', () => {
    const sanitized = sanitizeTelemetryEvent({
      uuid: '00000000-0000-4000-8000-000000000001',
      event: 'application_loaded',
      properties: {
        token: 'phc_test',
        distinct_id: 'anonymous-device',
        $geoip_disable: true,
        entry_point: 'direct',
        $current_url: 'https://private.example/project/123',
        $raw_user_agent: 'private-browser-detail',
        $browser: 'Chrome',
        $os: 'Windows',
        $geoip_country_code: 'US',
        arbitrary_value: 'must-not-leak',
      },
    });

    expect(sanitized?.properties).toEqual({
      token: 'phc_test',
      distinct_id: 'anonymous-device',
      $geoip_disable: true,
      entry_point: 'direct',
    });
  });

  it('drops events outside the application allowlist', () => {
    expect(sanitizeTelemetryEvent({
      uuid: '00000000-0000-4000-8000-000000000002',
      event: 'telemetry_probe',
      properties: { value: 'unexpected' },
    })).toBeNull();
  });

  it('keeps the configured host on the CSP-allowlisted PostHog endpoint', () => {
    const client = { init: vi.fn(), capture: vi.fn() };

    initializeAnalytics({ key: 'phc_test', apiHost: 'https://eu.i.posthog.com', client });

    expect(client.init).toHaveBeenCalledWith('phc_test', expect.objectContaining({ api_host: 'https://us.i.posthog.com' }));
  });

});
