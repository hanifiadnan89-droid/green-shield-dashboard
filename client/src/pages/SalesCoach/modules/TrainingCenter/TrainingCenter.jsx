import { useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Check, X, ToggleLeft, ToggleRight, Database, Upload, BookOpen, Clock } from 'lucide-react';
import { salesCoachApi } from '../../api/salesCoachApi.js';
import { TRAINING_TABS, TYPE_CONFIG, OUTCOME_LABELS, OUTCOME_EMOJI } from './constants.js';
import KnowledgeUploader from './KnowledgeUploader.jsx';
import KnowledgeBase from './KnowledgeBase.jsx';
import { useEffect } from 'react';

// ── Main tabs ─────────────────────────────────────────────────────────────────

const MAIN_TABS = [
  { id: 'kb',       label: 'Knowledge Base',   icon: Database,  desc: 'AI-processed documents, videos, audio, images, and URLs' },
  { id: 'upload',   label: 'Add Content',       icon: Upload,    desc: 'Upload files, paste a URL, or type knowledge directly' },
  { id: 'training', label: 'Training Items',    icon: BookOpen,  desc: 'Manually curated principles, scripts, and corrections' },
  { id: 'sessions', label: 'Session History',   icon: Clock,     desc: 'Past Objection Coach sessions' },
];

// ── Session History ───────────────────────────────────────────────────────────

function SessionRow({ session }) {
  const outcome = session.outcome?.outcome;
  const emoji   = outcome ? (OUTCOME_EMOJI[outcome] ?? '') : '';
  const label   = outcome ? (OUTCOME_LABELS[outcome] ?? outcome) : null;
  const ts      = session.updatedAt || session.createdAt;
  const timeStr = ts ? new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }) : '';
  return (
    <div className="tc-session-row">
      <div className="tc-session-row__module">{session.module ?? '—'}</div>
      <div className="tc-session-row__situation">{session.situation ?? '—'}</div>
      <div className="tc-session-row__meta">
        {label && <span className="tc-session-row__outcome">{emoji} {label}</span>}
        {session.feedback?.type && (
          <span className="tc-session-row__feedback">
            {session.feedback.type === 'thumbs_up' ? '👍' : session.feedback.type === 'thumbs_down' ? '👎' : '⭐'} {session.feedback.type.replace('_', ' ')}
          </span>
        )}
        {timeStr && <span className="tc-session-row__time">{timeStr}</span>}
      </div>
    </div>
  );
}

function SessionsTab() {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    salesCoachApi.sessions.list({ limit: 50 })
      .then(data => setSessions(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="tc-loading">Loading sessions…</div>;
  if (error)   return <div className="tc-error">{error}</div>;
  if (!sessions.length) {
    return (
      <div className="tc-empty">
        <div className="tc-empty__title">No sessions yet</div>
        <div className="tc-empty__hint">Sessions are recorded automatically every time you use Objection Coach.</div>
      </div>
    );
  }
  return <div className="tc-sessions-list">{sessions.map(s => <SessionRow key={s.id} session={s} />)}</div>;
}

// ── Training Items ────────────────────────────────────────────────────────────

function ItemForm({ type, item, onSave, onCancel, saving }) {
  const config = TYPE_CONFIG[type] || {};
  const [title,   setTitle]   = useState(item?.title   ?? '');
  const [content, setContent] = useState(item?.content ?? '');
  const [context, setContext] = useState(item?.context ?? '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave({ title: title.trim(), content: content.trim(), context: context.trim() || null, type });
  };

  return (
    <form className="tc-form" onSubmit={handleSubmit}>
      <div className="tc-form__field">
        <label className="tc-form__label">{config.titleLabel || 'Title'}</label>
        <input className="tc-form__input" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={config.titlePlaceholder} required />
      </div>
      <div className="tc-form__field">
        <label className="tc-form__label">{config.contentLabel || 'Content'}</label>
        <textarea className="tc-form__textarea" rows={4} value={content} onChange={e => setContent(e.target.value)} placeholder={config.contentPlaceholder} required />
      </div>
      <div className="tc-form__field">
        <label className="tc-form__label">{config.contextLabel || 'Context (optional)'}</label>
        <input className="tc-form__input" type="text" value={context} onChange={e => setContext(e.target.value)} placeholder={config.contextPlaceholder} />
      </div>
      <div className="tc-form__actions">
        <button type="button" className="tc-btn tc-btn--ghost" onClick={onCancel} disabled={saving}><X size={13} /> Cancel</button>
        <button type="submit" className="tc-btn tc-btn--primary" disabled={saving || !title.trim() || !content.trim()}><Check size={13} /> {saving ? 'Saving…' : item ? 'Update' : 'Add'}</button>
      </div>
    </form>
  );
}

function ItemCard({ item, onEdit, onDelete, onToggle, deleting }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`tc-item${item.active ? '' : ' tc-item--inactive'}`}>
      <div className="tc-item__header">
        <div className="tc-item__title" onClick={() => setExpanded(v => !v)}>
          {item.title}
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
        <div className="tc-item__actions">
          <button className="tc-icon-btn" title={item.active ? 'Deactivate' : 'Activate'} onClick={() => onToggle(item)}>
            {item.active ? <ToggleRight size={15} className="tc-toggle--on" /> : <ToggleLeft size={15} className="tc-toggle--off" />}
          </button>
          <button className="tc-icon-btn" title="Edit" onClick={() => onEdit(item)}><Edit2 size={13} /></button>
          <button className="tc-icon-btn tc-icon-btn--danger" title="Delete" onClick={() => onDelete(item.id)} disabled={deleting === item.id}><Trash2 size={13} /></button>
        </div>
      </div>
      {expanded && (
        <div className="tc-item__body">
          <p className="tc-item__content">{item.content}</p>
          {item.context && <p className="tc-item__context">{item.context}</p>}
        </div>
      )}
    </div>
  );
}

function TrainingSubTab({ type }) {
  const config = TYPE_CONFIG[type] || {};
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    salesCoachApi.training.list(type)
      .then(data => setItems(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (body) => {
    setSaving(true);
    try {
      if (editItem) {
        const updated = await salesCoachApi.training.update(editItem.id, body);
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
      } else {
        const created = await salesCoachApi.training.create(body);
        setItems(prev => [created, ...prev]);
      }
      setShowForm(false); setEditItem(null);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try { await salesCoachApi.training.delete(id); setItems(prev => prev.filter(i => i.id !== id)); }
    catch (e) { setError(e.message); }
    finally { setDeleting(null); }
  };

  const handleToggle = async (item) => {
    try {
      const updated = await salesCoachApi.training.update(item.id, { active: !item.active });
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="tc-tab-content">
      <div className="tc-tab-header">
        <p className="tc-tab-desc">{config.description}</p>
        {!showForm && <button className="tc-btn tc-btn--primary tc-btn--sm" onClick={() => { setEditItem(null); setShowForm(true); }}><Plus size={13} /> Add</button>}
      </div>
      {error && <div className="tc-error">{error}</div>}
      {showForm && <ItemForm type={type} item={editItem} onSave={handleSave} onCancel={() => { setShowForm(false); setEditItem(null); }} saving={saving} />}
      {loading ? <div className="tc-loading">Loading…</div>
        : items.length === 0 && !showForm ? (
          <div className="tc-empty">
            <div className="tc-empty__title">No {config.titleLabel?.toLowerCase() || 'items'} yet</div>
            <div className="tc-empty__hint">Add your first entry to start influencing AI coaching responses.</div>
          </div>
        ) : (
          <div className="tc-items-list">
            {items.map(item => <ItemCard key={item.id} item={item} onEdit={(i) => { setEditItem(i); setShowForm(true); }} onDelete={handleDelete} onToggle={handleToggle} deleting={deleting} />)}
          </div>
        )}
    </div>
  );
}

function TrainingTab() {
  const [subTab, setSubTab] = useState('principle');
  const trainingTabs = TRAINING_TABS.filter(t => t.id !== 'sessions');

  return (
    <div className="tc-training-wrap">
      <div className="tc-sub-nav">
        {trainingTabs.map(t => (
          <button key={t.id} className={`tc-sub-nav__item${subTab === t.id ? ' tc-sub-nav__item--active' : ''}`} onClick={() => setSubTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <TrainingSubTab key={subTab} type={subTab} />
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function TrainingCenter() {
  const [activeTab,      setActiveTab]      = useState('kb');
  const [kbRefreshKey,   setKbRefreshKey]   = useState(0);

  const handleItemCreated = useCallback(() => {
    setKbRefreshKey(k => k + 1);
  }, []);

  return (
    <div className="tc-root">
      <div className="tc-sidebar">
        <div className="tc-sidebar__title">AI Brain</div>
        <div className="tc-sidebar__desc">
          The knowledge foundation that trains your Sales Coach. Every upload becomes permanent, searchable intelligence.
        </div>
        <nav className="tc-nav">
          {MAIN_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tc-nav__item${activeTab === tab.id ? ' tc-nav__item--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={13} style={{ flexShrink: 0 }} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="tc-sidebar__footer">
          Every item in the Knowledge Base is automatically retrieved during coaching sessions via semantic search.
        </div>
      </div>

      <div className="tc-main">
        {activeTab === 'kb'       && <KnowledgeBase refreshTrigger={kbRefreshKey} />}
        {activeTab === 'upload'   && <KnowledgeUploader onItemCreated={handleItemCreated} />}
        {activeTab === 'training' && <TrainingTab />}
        {activeTab === 'sessions' && <SessionsTab />}
      </div>
    </div>
  );
}
