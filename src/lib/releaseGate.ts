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
