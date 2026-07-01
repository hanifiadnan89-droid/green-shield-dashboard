import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, RefreshCw, Save } from 'lucide-react';
import { api } from '../../../api/client.js';

const EMPTY_FORM = {
  google: {
    masterLeadSheetId: '',
    leadResponsesSheetId: '',
    customerDatabaseSheetId: '',
  },
  gmail: {
    senderEmail: '',
  },
  twilio: {
    phoneNumber: '',
    messagingServiceSid: '',
  },
  future: {
    notes: '',
  },
};

function toForm(profile) {
  return {
    google: {
      masterLeadSheetId: profile?.google?.masterLeadSheetId || '',
      leadResponsesSheetId: profile?.google?.leadResponsesSheetId || '',
      customerDatabaseSheetId: profile?.google?.customerDatabaseSheetId || '',
    },
    gmail: {
      senderEmail: profile?.gmail?.senderEmail || '',
    },
    twilio: {
      phoneNumber: profile?.twilio?.phoneNumber || '',
      messagingServiceSid: profile?.twilio?.messagingServiceSid || '',
    },
    future: {
      notes: profile?.future?.notes || '',
    },
  };
}

export default function UserIntegrationsPage() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [health, setHealth] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [userRes, profileRes, healthRes] = await Promise.all([
          api.adminUsers.get(userId),
          api.adminIntegrations.get(userId),
          api.adminIntegrations.health(userId),
        ]);
        if (cancelled) return;
        setUser(userRes.user || null);
        setProfile(profileRes.profile || null);
        setHealth(healthRes.health || null);
        setForm(toForm(profileRes.profile));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load integration profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  const title = useMemo(
    () => user?.displayName || user?.name || 'Integration Profile',
    [user],
  );

  const healthRows = [
    { label: 'Google Sheets', data: health?.googleSheets },
    { label: 'Gmail', data: health?.gmail },
    { label: 'Twilio', data: health?.twilio },
    { label: 'FieldRoutes', data: health?.fieldRoutes },
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.adminIntegrations.update(userId, {
        google: form.google,
        gmail: form.gmail,
        twilio: form.twilio,
        future: {
          fieldRoutes: null,
          notes: form.future.notes || null,
        },
      });
      const refreshed = await api.adminIntegrations.get(userId);
      setProfile(refreshed.profile || null);
      setForm(toForm(refreshed.profile));
      const refreshedHealth = await api.adminIntegrations.health(userId);
      setHealth(refreshedHealth.health || null);
    } catch (err) {
      setError(err.message || 'Could not save integration profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-5 bg-white border-b border-gs-border flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gs-text tracking-tight">Manage Integrations</h1>
          <p className="text-gs-muted text-xs mt-0.5">{title} · {user?.email || userId}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/users" className="btn-ghost text-xs no-underline">Back to Users</Link>
          <button type="button" className="btn-ghost text-xs gap-1.5" onClick={() => window.location.reload()}>
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      <div className="px-6 py-5 max-w-5xl space-y-5">
        {error && (
          <div className="card border-red-200 bg-red-50/70 text-gs-danger flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-gs-text text-sm">Integration Health</h2>
              <p className="text-xs text-gs-muted mt-0.5">Read-only configuration status from the resolver layer.</p>
            </div>
            <span className="text-xs text-gs-muted">{loading ? 'Loading…' : 'Static config only'}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {healthRows.map((row) => {
              const configured = row.data?.configured;
              return (
                <div key={row.label} className="rounded-xl border border-gs-border bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-gs-text">{row.label}</h3>
                    <span className={`text-[11px] font-semibold uppercase tracking-widest ${configured ? 'text-gs-accent' : 'text-gs-danger'}`}>
                      {loading ? 'Loading…' : configured ? 'Configured' : 'Missing'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gs-muted">Source: {loading ? 'loading…' : (row.data?.source || 'env')}</p>
                  <p className="mt-1 text-xs text-gs-muted">
                    Missing: {loading ? 'loading…' : ((row.data?.missing || []).length ? row.data.missing.join(', ') : 'None')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="card">
            <h2 className="font-semibold text-gs-text text-sm mb-4">Google Sheets</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="label" htmlFor="masterLeadSheetId">Master Lead Sheet</label>
                <input
                  id="masterLeadSheetId"
                  className="input"
                  value={form.google.masterLeadSheetId}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    google: { ...prev.google, masterLeadSheetId: e.target.value },
                  }))}
                  placeholder="Spreadsheet ID"
                />
              </div>
              <div>
                <label className="label" htmlFor="leadResponsesSheetId">Lead Responses Sheet</label>
                <input
                  id="leadResponsesSheetId"
                  className="input"
                  value={form.google.leadResponsesSheetId}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    google: { ...prev.google, leadResponsesSheetId: e.target.value },
                  }))}
                  placeholder="Spreadsheet ID"
                />
              </div>
              <div>
                <label className="label" htmlFor="customerDatabaseSheetId">Customer Database</label>
                <input
                  id="customerDatabaseSheetId"
                  className="input"
                  value={form.google.customerDatabaseSheetId}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    google: { ...prev.google, customerDatabaseSheetId: e.target.value },
                  }))}
                  placeholder="Optional spreadsheet ID"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gs-text text-sm mb-4">Gmail</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="senderEmail">Sender Email</label>
                <input
                  id="senderEmail"
                  className="input"
                  type="email"
                  value={form.gmail.senderEmail}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    gmail: { ...prev.gmail, senderEmail: e.target.value },
                  }))}
                  placeholder="rep@company.com"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gs-text text-sm mb-4">Twilio</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="phoneNumber">Phone Number</label>
                <input
                  id="phoneNumber"
                  className="input"
                  value={form.twilio.phoneNumber}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    twilio: { ...prev.twilio, phoneNumber: e.target.value },
                  }))}
                  placeholder="+15551234567"
                />
              </div>
              <div>
                <label className="label" htmlFor="messagingServiceSid">Messaging Service SID</label>
                <input
                  id="messagingServiceSid"
                  className="input"
                  value={form.twilio.messagingServiceSid}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    twilio: { ...prev.twilio, messagingServiceSid: e.target.value },
                  }))}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gs-text text-sm mb-4">Future</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="label" htmlFor="futureNotes">Notes</label>
                <textarea
                  id="futureNotes"
                  className="input min-h-[100px]"
                  value={form.future.notes}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    future: { ...prev.future, notes: e.target.value },
                  }))}
                  placeholder="Internal notes"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button type="submit" className="btn-primary" disabled={saving || loading}>
              <Save size={14} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
