'use client';

// app/admin/events/page.tsx
// Lets a Church Administrator schedule events and manage their registration
// roster — a named member, or a walk-in guest captured by name/contact.

import { useEffect, useState } from 'react';
import {
  eventsApi,
  eventRegistrationsApi,
  branchesApi,
  membersApi,
  configApi,
  Event,
  EventRegistration,
  Branch,
  Member,
} from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const TENANT_SLUG = 'demo-church';

export default function EventsAdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [eventTypes, setEventTypes] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('');
  const [branchId, setBranchId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [roster, setRoster] = useState<EventRegistration[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [mode, setMode] = useState<'member' | 'guest'>('member');
  const [regMemberId, setRegMemberId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, branchesRes, membersRes, typesRes] = await Promise.all([
        eventsApi.list(TENANT_SLUG),
        branchesApi.list(TENANT_SLUG),
        membersApi.list(TENANT_SLUG, {}),
        configApi.listByNamespace(TENANT_SLUG, 'event_type'),
      ]);
      if (eventsRes.success && eventsRes.data) setEvents(eventsRes.data);
      else setError(eventsRes.error?.message ?? 'Could not load events.');
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
      if (membersRes.success && membersRes.data) setMembers(membersRes.data);
      if (typesRes.success && typesRes.data) setEventTypes(typesRes.data as { key: string; label: string }[]);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadRoster(eventId: string) {
    setRosterLoading(true);
    try {
      const res = await eventRegistrationsApi.list(TENANT_SLUG, { eventId });
      if (res.success && res.data) setRoster(res.data);
      else setError(res.error?.message ?? 'Could not load the roster.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setRosterLoading(false);
    }
  }

  function selectEvent(event: Event) {
    setSelectedEventId(event.id);
    loadRoster(event.id);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startsAt) {
      setError('Name and start date/time are required.');
      return;
    }
    try {
      const res = await eventsApi.create(TENANT_SLUG, {
        name: name.trim(),
        eventType: eventType || undefined,
        branchId: branchId || undefined,
        startsAt: new Date(startsAt).toISOString(),
        location: location.trim() || undefined,
        capacity: capacity ? Number(capacity) : undefined,
      });
      if (res.success) {
        setName('');
        setEventType('');
        setBranchId('');
        setStartsAt('');
        setLocation('');
        setCapacity('');
        load();
      } else {
        setError(res.error?.message ?? 'Could not create the event.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemoveEvent(id: string) {
    try {
      const res = await eventsApi.remove(TENANT_SLUG, id);
      if (res.success) {
        if (selectedEventId === id) setSelectedEventId(null);
        load();
      } else {
        setError(res.error?.message ?? 'Could not remove the event.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEventId) return;
    if (mode === 'member' && !regMemberId) return;
    if (mode === 'guest' && !guestName.trim()) return;
    try {
      const res = await eventRegistrationsApi.create(TENANT_SLUG, {
        eventId: selectedEventId,
        memberId: mode === 'member' ? regMemberId : undefined,
        guestName: mode === 'guest' ? guestName.trim() : undefined,
        guestContact: mode === 'guest' ? guestContact.trim() || undefined : undefined,
      });
      if (res.success) {
        setRegMemberId('');
        setGuestName('');
        setGuestContact('');
        loadRoster(selectedEventId);
      } else {
        setError(res.error?.message ?? 'Could not register.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleCancelRegistration(id: string) {
    if (!selectedEventId) return;
    try {
      const res = await eventRegistrationsApi.remove(TENANT_SLUG, id);
      if (res.success) loadRoster(selectedEventId);
      else setError(res.error?.message ?? 'Could not cancel the registration.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function branchName(id: string | null) {
    if (!id) return 'Church-wide';
    return branches.find((b) => b.id === id)?.name ?? '—';
  }

  function memberName(id: string | null) {
    if (!id) return null;
    const m = members.find((mm) => mm.id === id);
    return m ? `${m.firstName} ${m.lastName}` : null;
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;
  const activeRosterCount = roster.filter((r) => r.status !== 'cancelled').length;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Events</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Events &amp; Registrations</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Schedule conferences, camps, and outreach — then register members or walk-in
            guests, with an optional capacity cap.
          </p>
        </header>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="evt-name" className="mb-1 text-slate-600">
                Name
              </Label>
              <Input id="evt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Youth Camp 2026" />
            </div>
            <div>
              <Label htmlFor="evt-type" className="mb-1 text-slate-600">
                Type (optional)
              </Label>
              <select
                id="evt-type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Unspecified —</option>
                {eventTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="evt-branch" className="mb-1 text-slate-600">
                Branch (optional)
              </Label>
              <select
                id="evt-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Church-wide —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="evt-starts" className="mb-1 text-slate-600">
                Starts
              </Label>
              <Input id="evt-starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="evt-location" className="mb-1 text-slate-600">
                Location (optional)
              </Label>
              <Input id="evt-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Kigali Convention Centre" />
            </div>
            <div>
              <Label htmlFor="evt-capacity" className="mb-1 text-slate-600">
                Capacity (optional)
              </Label>
              <Input id="evt-capacity" type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Unlimited" />
            </div>
          </div>
          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>
            Create event
          </Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : events.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No events yet. Create your first one above.
              </div>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => selectEvent(ev)}
                  className={`flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer ${
                    selectedEventId === ev.id ? 'bg-[#1E2A44]/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{ev.name}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(ev.startsAt).toLocaleString()} · {branchName(ev.branchId)}
                      {ev.capacity ? ` · cap ${ev.capacity}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveEvent(ev.id);
                    }}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {!selectedEvent ? (
              <div className="py-8 text-center text-sm text-slate-400">Select an event to manage registrations.</div>
            ) : (
              <>
                <h2 className="font-serif text-lg text-[#1E2A44] mb-1">{selectedEvent.name} roster</h2>
                {selectedEvent.capacity && (
                  <p className="text-xs text-slate-400 mb-3">
                    {activeRosterCount} / {selectedEvent.capacity} registered
                  </p>
                )}
                <form onSubmit={handleRegister} className="space-y-2 mb-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('member')}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        mode === 'member' ? 'bg-[#1E2A44] text-white border-[#1E2A44]' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      Member
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('guest')}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        mode === 'guest' ? 'bg-[#1E2A44] text-white border-[#1E2A44]' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      Walk-in guest
                    </button>
                  </div>
                  {mode === 'member' ? (
                    <select
                      value={regMemberId}
                      onChange={(e) => setRegMemberId(e.target.value)}
                      className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                    >
                      <option value="">— Select a member —</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.firstName} {m.lastName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest name" />
                      <Input value={guestContact} onChange={(e) => setGuestContact(e.target.value)} placeholder="Contact (optional)" />
                    </div>
                  )}
                  <Button type="submit" size="sm" style={{ backgroundColor: '#1E2A44' }}>
                    Register
                  </Button>
                </form>

                {rosterLoading ? (
                  <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
                ) : roster.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">No registrations yet.</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {roster.map((r) => (
                      <div key={r.id} className="flex items-center justify-between py-2">
                        <div>
                          <p className={`text-sm font-medium ${r.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                            {memberName(r.memberId) ?? r.guestName ?? '—'}
                          </p>
                          <p className="text-xs text-slate-400">{r.status}</p>
                        </div>
                        {r.status !== 'cancelled' && (
                          <button
                            onClick={() => handleCancelRegistration(r.id)}
                            className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
