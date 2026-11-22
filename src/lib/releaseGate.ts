/**
 * spec-fan-app-prod-cleanup-and-team-names D2 — the one switch for the fan
 * screens that are not released yet (standings, schedule, search, club and
 * player detail, onboarding, news, notifications, profile).
 *
 * Hidden on a production build unless VITE_ENABLE_UNRELEASED_PAGES is 'true'.
 * Dev builds always show them. `import.meta.env` stays literal here (Vite
 * injects it per module; docs/knowledge/LEARNED.md 2026-05-07).
 */
export function unreleasedPagesHidden(): boolean {
  return Boolean(import.meta.env.PROD) && import.meta.env.VITE_ENABLE_UNRELEASED_PAGES !== 'true';
}

/**
 * spec-fan-app-youtube-stream-preview D-2 — independent test-only gate for
 * fan-app YouTube stream previews and card indicators.
 *
 * Enabled in non-production builds and when VITE_ENABLE_FAN_YOUTUBE_PREVIEW
 * is 'true'; hidden in production builds by default. Keep `import.meta.env`
 * literal for Vite static replacement.
 */
export function youtubeStreamPreviewEnabled(): boolean {
  return !import.meta.env.PROD || import.meta.env.VITE_ENABLE_FAN_YOUTUBE_PREVIEW === 'true';
}
