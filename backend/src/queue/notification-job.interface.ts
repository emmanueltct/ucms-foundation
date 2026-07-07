export type NotificationChannel = 'email' | 'sms' | 'push';

export interface NotificationJobData {
  notificationId: string;
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
}
