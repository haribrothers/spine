/** Mirrors apps/api/src/db/schema/notifications.ts's row shape — apps/web has no generated SDK yet (packages/sdk is still empty), so this is hand-written to match the API's JSON response shape, following every other module's own types.ts precedent (e.g. apps/web/src/app/quotes/types.ts). */
export interface AppNotification {
  id: string;
  orgId: string;
  recipientUserId: string;
  type: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
