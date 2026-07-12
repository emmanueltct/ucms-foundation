'use client';

// app/admin/notifications/page.tsx
// Lets a Church Administrator send a notification (email/sms/push) to a
// named member or an explicit address, and review send history/status.
// Actual delivery is a documented stub (see docs/communication) — this page
// exercises the real queue -> status-update pipeline end to end.

import { useEffect, useState } from 'react';
import { notificationsApi, membersApi, isAccessDeniedResponse, Notification, Member } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { AccessDenied } from '../../../components/access-denied';

const TENANT_SLUG = 'demo-church'; // in production this comes from the resolved workspace/domain
const CHANNELS = ['email', 'sms', 'push'] as const;

export default function NotificationsAdminPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('sms');
  const [mode, setMode] = useState<'member' | 'explicit'>('member');
  const [memberId, setMemberId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [notifRes, membersRes] = await Promise.all([
        notificationsApi.list(TENANT_SLUG),
        membersApi.list(TENANT_SLUG, {}),
      ]);
      if (isAccessDeniedResponse(notifRes)) {
        setAccessDenied(true);
        return;
      }
      if (notifRes.success && notifRes.data) setNotifications(notifRes.data);
      else setError(notifRes.error?.message ?? 'Could not load notification history.');
      if (membersRes.success && membersRes.data) setMembers(membersRes.data);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      const res = await notificationsApi.create(TENANT_SLUG, {
        channel,
        memberId: mode === 'member' ? memberId || undefined : undefined,
        recipient: mode === 'explicit' ? recipient.trim() || undefined : undefined,
        subject: channel === 'email' ? subject.trim() || undefined : undefined,
        body: body.trim(),
      });
      if (res.success) {
        setBody('');
        setSubject('');
        setRecipient('');
        load();
      } else {
        setError(res.error?.message ?? 'Could not send the notification.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function memberName(id: string | null) {
    if (!id) return null;
    const m = members.find((mm) => mm.id === id);
    return m ? `${m.firstName} ${m.lastName}` : null;
  }

  function statusBadge(status: Notification['status']) {
    const styles: Record<Notification['status'], string> = {
      queued: 'text-slate-500 bg-slate-100 border-slate-200',
      sent: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      failed: 'text-red-700 bg-red-50 border-red-200',
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${styles[status]}`}>{status}</span>
    );
  }

  if (accessDenied) return <AccessDenied />;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Communication</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Notifications</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Send a message by email, SMS, or push, then watch its status move from queued to
            sent (or failed) as the background worker processes it.
          </p>
        </header>

        <form onSubmit={handleSend} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="flex gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors capitalize ${
                  channel === c ? 'bg-[#1E2A44] text-white border-[#1E2A44]' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('member')}
              disabled={channel === 'push'}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors disabled:opacity-40 ${
                mode === 'member' ? 'bg-[#1E2A44] text-white border-[#1E2A44]' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              To a member
            </button>
            <button
              type="button"
              onClick={() => setMode('explicit')}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                mode === 'explicit' ? 'bg-[#1E2A44] text-white border-[#1E2A44]' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              Explicit address
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mode === 'member' ? (
              <div>
                <Label htmlFor="notif-member" className="mb-1 text-slate-600">
                  Member
                </Label>
                <select
                  id="notif-member"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                >
                  <option value="">— Select a member —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <Label htmlFor="notif-recipient" className="mb-1 text-slate-600">
                  Recipient
                </Label>
                <Input
                  id="notif-recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={channel === 'email' ? 'pastor@church.rw' : channel === 'sms' ? '+250780000000' : 'device token'}
                />
              </div>
            )}
            {channel === 'email' && (
              <div>
                <Label htmlFor="notif-subject" className="mb-1 text-slate-600">
                  Subject
                </Label>
                <Input id="notif-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Service update" />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="notif-body" className="mb-1 text-slate-600">
              Message
            </Label>
            <textarea
              id="notif-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Service starts at 9am this Sunday."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
            />
          </div>

          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>
            Send
          </Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No notifications yet. Send your first one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-medium">Channel</th>
                    <th className="px-4 py-3 font-medium">To</th>
                    <th className="px-4 py-3 font-medium">Message</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3 text-slate-600 capitalize">{n.channel}</td>
                      <td className="px-4 py-3 text-slate-600">{memberName(n.recipientMemberId) ?? n.recipient}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{n.subject ? `${n.subject} — ` : ''}{n.body}</td>
                      <td className="px-4 py-3">{statusBadge(n.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
