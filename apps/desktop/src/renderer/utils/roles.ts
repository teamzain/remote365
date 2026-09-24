// Role helpers (extracted from App.tsx, behaviour unchanged).

export const canViewPlatformAnalytics = (role?: string | null) =>
  String(role || '').toUpperCase() === 'SUPER_ADMIN';
