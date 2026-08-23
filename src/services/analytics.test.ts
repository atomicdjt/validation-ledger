import { describe, expect, it, vi } from 'vitest';
import { createAnalytics, getAnalyticsConfig } from './analytics';

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

  it('blacklists automatic URL context from every captured event', () => {
    const config = getAnalyticsConfig('https://us.i.posthog.com');
    expect(config.property_blacklist).toContain('$current_url');
    expect(config.property_blacklist).toContain('$raw_user_agent');
  });

  it('strips browser, location, and arbitrary content before sending', () => {
    const config = getAnalyticsConfig('https://us.i.posthog.com');
    const data = config.before_send?.({
      uuid: 'test-uuid',
      event: 'application_loaded',
      properties: {
        entry_point: 'direct',
        '$current_url': 'https://private.example/path',
        '$raw_user_agent': 'secret browser detail',
        '$geoip_city_name': 'Richmond',
        evidence_text: 'do not send',
      },
    });

    expect(data?.properties).toEqual({ entry_point: 'direct', $geoip_disable: true });
  });
});
