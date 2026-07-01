import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Pencil, Plus, RefreshCw, UserX, UserCheck, X } from 'lucide-react';
import { api } from '../../../api/client.js';

const EMPTY_FORM = {
  name: '',
  displayName: '',
  email: '',
  initials: '',
  role: 'sales_rep',
  status: 'active',
};

function StatusBadge({ status }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest ${
      active ? 'bg-green-50 text-gs-accent border border-green-200' : 'bg-slate-100 text-gs-muted border border-slate-200'
    }`}>
      {active ? <CheckCircle2 size={12} /> : <X size={12} />}
      {status}
    </span>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const data = await api.adminUsers.list();
      setUsers(data.users || []);
      setOrganization(data.organization || null);
    } catch (err) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const activeCount = useMemo(() => users.filter((user) => user.status === 'active').length, [users]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(user) {
    setEditingId(user.id);
      setForm({
        name: user.name || '',
        displayName: user.displayName || '',
        email: user.email || '',
        initials: user.initials || '',
        role: user.role || 'sales_rep',
        status: user.status || 'active',
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.adminUsers.update(editingId, form);
      } else {
        await api.adminUsers.create(form);
      }
      await loadUsers();
      startCreate();
    } catch (err) {
      setError(err.message || 'Could not save user.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user) {
    setSaving(true);
    setError('');
    try {
      if (user.status === 'active') {
        await api.adminUsers.deactivate(user.id);
      } else {
        await api.adminUsers.reactivate(user.id);
      }
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Could not update user status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-5 bg-white border-b border-gs-border flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gs-text tracking-tight">Admin Users</h1>
          <p className="text-gs-muted text-xs mt-0.5">
            {organization?.name || 'Green Shield Pest Solutions'} · {activeCount} active user{activeCount === 1 ? '' : 's'}
          </p>
        </div>
        <button onClick={loadUsers} className="btn-ghost text-xs gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="px-6 py-5 space-y-5">
        {error && (
          <div className="card border-red-200 bg-red-50/70 text-gs-danger flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-gs-text text-sm">{editingId ? 'Edit User' : 'Add User'}</h2>
              <p className="text-xs text-gs-muted mt-0.5">Manage internal Green Shield employees from one place.</p>
            </div>
            {editingId && (
              <button type="button" className="btn-ghost text-xs gap-1.5" onClick={startCreate}>
                <X size={13} />
                Cancel
              </button>
            )}
          </div>

          <form className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3" onSubmit={handleSubmit}>
            <div>
              <label className="label" htmlFor="admin-user-name">Name</label>
              <input
                id="admin-user-name"
                className="input"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="admin-user-display-name">Display Name</label>
              <input
                id="admin-user-display-name"
                className="input"
                value={form.displayName}
                onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder="Defaults to name"
              />
            </div>
            <div>
              <label className="label" htmlFor="admin-user-email">Email</label>
              <input
                id="admin-user-email"
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="admin-user-initials">Initials</label>
              <input
                id="admin-user-initials"
                className="input uppercase"
                value={form.initials}
                onChange={(e) => setForm((prev) => ({ ...prev, initials: e.target.value.toUpperCase() }))}
                maxLength={6}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="admin-user-role">Role</label>
              <select
                id="admin-user-role"
                className="select"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="sales_rep">Sales Rep</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="admin-user-status">Status</label>
              <select
                id="admin-user-status"
                className="select"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="md:col-span-2 xl:col-span-6 flex items-center justify-end gap-2 pt-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                <Plus size={14} />
                {saving ? 'Saving…' : editingId ? 'Update User' : 'Add User'}
              </button>
            </div>
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-gs-text text-sm">Users</h2>
            <span className="text-xs text-gs-muted">{users.length} total</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gs-border">
                  <th className="th">Name</th>
                  <th className="th">Email</th>
                  <th className="th">Initials</th>
                  <th className="th">Role</th>
                  <th className="th">Status</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="td text-gs-muted" colSpan={6}>Loading users…</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td className="td text-gs-muted" colSpan={6}>No users found.</td>
                  </tr>
                ) : users.map((user) => (
                  <tr key={user.id} className="table-row">
                    <td className="td font-medium">{user.displayName || user.name}</td>
                    <td className="td text-gs-muted">{user.email}</td>
                    <td className="td text-gs-muted font-semibold">{user.initials}</td>
                    <td className="td">
                      <span className="inline-flex rounded-full border border-gs-border bg-white px-2.5 py-1 text-xs font-medium capitalize">
                        {user.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="td"><StatusBadge status={user.status} /></td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <button type="button" className="btn-ghost text-xs gap-1.5" onClick={() => startEdit(user)}>
                          <Pencil size={13} />
                          Edit
                        </button>
                        <button
                          type="button"
                          className={user.status === 'active' ? 'btn-warn text-xs gap-1.5' : 'btn-primary text-xs gap-1.5'}
                          onClick={() => toggleStatus(user)}
                        >
                          {user.status === 'active' ? <UserX size={13} /> : <UserCheck size={13} />}
                          {user.status === 'active' ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <Link to={`/admin/users/${user.id}/integrations`} className="btn-ghost text-xs gap-1.5 no-underline">
                          Manage Integrations
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
