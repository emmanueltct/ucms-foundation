/**
 * Central registry of BullMQ queue names. Modules that need async work
 * (Communication's SMS/Email/Push, future report generation, etc.) register
 * their own queue here and inject it via `@InjectQueue(QUEUE_NAMES.X)`
 * rather than standing up a new Redis connection.
 */
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
} as const;
