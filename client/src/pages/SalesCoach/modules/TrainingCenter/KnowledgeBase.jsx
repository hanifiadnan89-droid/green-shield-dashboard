import { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, RefreshCw, Trash2, Edit2, ChevronDown, ChevronUp,
  CheckCircle2, Clock, AlertCircle, Loader2, FileText, FileAudio,
  FileVideo, Image, Globe, Youtube, File, Tag, Eye, EyeOff,
} from 'lucide-react';
import { api } from '../../../../api/client.js';

const SOURCE_TYPE_ICONS = {
  file:    File,
  url:     Globe,
  youtube: Youtube,
  text:    FileText,
  audio:   FileAudio,
  video:   FileVideo,
  image:   Image,
};

const SOURCE_TYPE_LABELS = {
  file:    'File',
  url:     'Web Page',
  youtube: 'YouTube',
  text:    'Manual Entry',
};

const STATUS_CONFIG = {
  ready:      { icon: CheckCircle2, color: '#15803d', label: 'Ready' },
  processing: { icon: Loader2,      color: '#2563eb', label: 'Processing' },
  pending:    { icon: Clock,        color: '#94a3b8', label: 'Pending' },
  error:      { icon: AlertCircle,  color: '#dc2626', label: 'Error' },
};

const ALL_TAGS = [
  'Closing', 'Objection Handling', 'Psychology', 'Trust Building',
  'Pricing', 'Value Framing', 'Negotiation', 'Risk Reversal',
  'Guarantees', 'Pest Knowledge', 'Competitor', 'Service Specific',
  'Sales Script', 'Customer Communication', 'Green Shield Internal',
];

const SOURCE_TYPES = ['file', 'url', 'youtube', 'text'];

function StatusBadge({ status }) {
  const cfg  = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className="kb-status-badge" style={{ color: cfg.color }}>
      <Icon size={11} className={status === 'processing' ? 'kb-spinner' : ''} />
      {cfg.label}
    </span>
  );
}

function StepDots({ steps }) {
  const order = ['extraction', 'chunking', 'embedding', 'tagging'];
  return (
    <div className="kb-step-dots">
      {order.map(s => (
        <span key={s} className={`kb-step-dot kb-step-dot--${steps?.[s] || 'pending'}`} title={s} />
      ))}
    </div>
  );
}

function KnowledgeCard({ item, onDelete, onUpdate, onReprocess }) {
  const [expanded,  setExpanded]  = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [newTitle,  setNewTitle]  = useState(item.title || '');
  const [newTags,   setNewTags]   = useState(item.tags || []);
  const [saving,    setSaving]    = useState(false);

  const Icon      = SOURCE_TYPE_ICONS[item.sourceType] || File;
  const srcLabel  = SOURCE_TYPE_LABELS[item.sourceType] || item.sourceType;
  const allTags   = [...new Set([...(item.tags || []), ...(item.autoTags || [])])];

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(item.id, { title: newTitle, tags: newTags });
      setEditing(false);
    } catch {}
    setSaving(false);
  };

  const toggleTag = (tag) => {
    setNewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div className={`kb-card${!item.active ? ' kb-card--inactive' : ''}`}>
      {/* Header */}
      <div className="kb-card__head">
        <div className="kb-card__icon-wrap">
          <Icon size={15} />
        </div>
        <div className="kb-card__info">
          {editing ? (
            <input
              className="kb-card__title-edit"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              autoFocus
            />
          ) : (
            <div className="kb-card__title">{item.title || item.fileName || 'Untitled'}</div>
          )}
          <div className="kb-card__meta">
            <span className="kb-card__src">{srcLabel}</span>
            {item.wordCount > 0 && <span className="kb-card__words">{item.wordCount.toLocaleString()} words</span>}
            {item.chunkCount > 0 && <span className="kb-card__chunks">{item.chunkCount} chunks</span>}
            <span className="kb-card__date">{new Date(item.uploadedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="kb-card__actions">
          <StatusBadge status={item.status} />
          {item.status === 'processing' && <StepDots steps={item.processingSteps} />}
          <button className="kb-icon-btn" title="Edit" onClick={() => { setEditing(v => !v); setNewTitle(item.title); setNewTags(item.tags || []); }}>
            <Edit2 size={13} />
          </button>
          <button className="kb-icon-btn" title={item.active ? 'Disable' : 'Enable'} onClick={() => onUpdate(item.id, { active: !item.active })}>
            {item.active ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button className="kb-icon-btn" title="Reprocess" onClick={() => onReprocess(item.id)}>
            <RefreshCw size={13} />
          </button>
          <button className="kb-icon-btn kb-icon-btn--danger" title="Delete" onClick={() => onDelete(item.id)}>
            <Trash2 size={13} />
          </button>
          <button className="kb-icon-btn" onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Tags row */}
      {allTags.length > 0 && !editing && (
        <div className="kb-card__tags">
          {allTags.map(t => (
            <span key={t} className={`kb-tag${(item.autoTags || []).includes(t) ? ' kb-tag--auto' : ''}`}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Edit mode tag picker */}
      {editing && (
        <div className="kb-tag-picker">
          <p className="kb-tag-picker__label">Tags</p>
          <div className="kb-tag-picker__grid">
            {ALL_TAGS.map(t => (
              <button
                key={t}
                className={`kb-tag-pick-btn${newTags.includes(t) ? ' kb-tag-pick-btn--active' : ''}`}
                onClick={() => toggleTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="kb-card__edit-actions">
            <button className="kb-btn kb-btn--ghost kb-btn--sm" onClick={() => setEditing(false)}>Cancel</button>
            <button className="kb-btn kb-btn--primary kb-btn--sm" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Summary + text preview */}
      {expanded && (
        <div className="kb-card__body">
          {item.summary && <p className="kb-card__summary">{item.summary}</p>}
          {item.keyInsights?.length > 0 && (
            <div className="kb-card__insights">
              <p className="kb-card__insights-label">Key Insights</p>
              <ul>
                {item.keyInsights.map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            </div>
          )}
          {item.extractedText && (
            <div className="kb-card__preview">
              <p className="kb-card__preview-label">Extracted Text Preview</p>
              <p className="kb-card__preview-text">{item.extractedText}</p>
            </div>
          )}
          {item.errorMessage && (
            <div className="kb-card__error">
              <AlertCircle size={13} /> {item.errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KnowledgeBase({ refreshTrigger }) {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [query,      setQuery]      = useState('');
  const [sourceType, setSourceType] = useState('');
  const [status,     setStatus]     = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (query)      params.query = query;
      if (sourceType) params.sourceType = sourceType;
      if (status)     params.status = status;
      const { items: data } = await api.kb.items({ ...params, limit: 100 });
      setItems(data || []);
    } catch {}
    setLoading(false);
  }, [query, sourceType, status]);

  useEffect(() => { loadItems(); }, [loadItems, refreshTrigger]);

  // Poll processing items every 5s
  useEffect(() => {
    const hasProcessing = items.some(i => i.status === 'processing' || i.status === 'pending');
    if (!hasProcessing) return;
    const t = setInterval(async () => {
      try {
        const { items: fresh } = await api.kb.items({ limit: 100 });
        setItems(fresh || []);
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [items]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this knowledge item and all its data?')) return;
    await api.kb.deleteItem(id);
    setItems(items => items.filter(i => i.id !== id));
  };

  const handleUpdate = async (id, patch) => {
    const { item } = await api.kb.updateItem(id, patch);
    setItems(items => items.map(i => i.id === id ? item : i));
    return item;
  };

  const handleReprocess = async (id) => {
    await api.kb.reprocess(id);
    loadItems();
  };

  const counts = {
    total: items.length,
    ready: items.filter(i => i.status === 'ready').length,
    processing: items.filter(i => i.status === 'processing' || i.status === 'pending').length,
  };

  return (
    <div className="kb-list-root">
      {/* Stats bar */}
      <div className="kb-stats">
        <span className="kb-stat"><strong>{counts.total}</strong> items</span>
        <span className="kb-stat kb-stat--green"><CheckCircle2 size={11} /> {counts.ready} ready</span>
        {counts.processing > 0 && (
          <span className="kb-stat kb-stat--blue"><Loader2 size={11} className="kb-spinner" /> {counts.processing} processing</span>
        )}
        <button className="kb-stat-refresh" onClick={loadItems} title="Refresh">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="kb-search-bar">
        <div className="kb-search-input-wrap">
          <Search size={14} className="kb-search-icon" />
          <input
            className="kb-search-input"
            type="text"
            placeholder="Search knowledge base…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <button className={`kb-filter-btn${showFilter ? ' kb-filter-btn--active' : ''}`} onClick={() => setShowFilter(v => !v)}>
          <Filter size={13} /> Filters
        </button>
      </div>

      {showFilter && (
        <div className="kb-filters">
          <select className="kb-filter-select" value={sourceType} onChange={e => setSourceType(e.target.value)}>
            <option value="">All source types</option>
            {SOURCE_TYPES.map(t => <option key={t} value={t}>{SOURCE_TYPE_LABELS[t] || t}</option>)}
          </select>
          <select className="kb-filter-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="error">Error</option>
          </select>
        </div>
      )}

      {/* Item list */}
      {loading ? (
        <div className="kb-loading"><Loader2 size={20} className="kb-spinner" /> Loading…</div>
      ) : items.length === 0 ? (
        <div className="kb-empty">
          <Tag size={32} className="kb-empty__icon" />
          <p className="kb-empty__title">No knowledge items yet</p>
          <p className="kb-empty__hint">Use the Upload tab to add documents, videos, audio, images, or URLs.</p>
        </div>
      ) : (
        <div className="kb-cards">
          {items.map(item => (
            <KnowledgeCard
              key={item.id}
              item={item}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              onReprocess={handleReprocess}
            />
          ))}
        </div>
      )}
    </div>
  );
}
