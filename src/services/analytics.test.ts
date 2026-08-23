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
    expect(getAnalyticsConfig('https://us.i.posthog.com').property_blacklist).toEqual([
      '$current_url',
      '$host',
      '$pathname',
      '$referrer',
      '$referring_domain',
    ]);
  });
});
