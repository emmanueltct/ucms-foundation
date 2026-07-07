export type NotificationChannel = 'email' | 'sms' | 'push';

export interface NotificationJobData {
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
}
