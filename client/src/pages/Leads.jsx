import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import { CATEGORY_META, filterLeads } from './Leads/leadsFilters.js';
import LeadsToolbar from './Leads/LeadsToolbar.jsx';
import LeadsTable from './Leads/LeadsTable.jsx';
import LeadsEmptyState from './Leads/LeadsEmptyState.jsx';
import EditLeadModal from './Leads/EditLeadModal.jsx';
import LeadDetailWorkspace from './Leads/LeadDetailWorkspace.jsx';
import './Leads/leads.css';

const EMPTY_FILTERS = { status: '', notes: '', stop: '', error: '', sms_reply: '', email_reply: '' };

export default function Leads() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || '';
  const categoryMeta = CATEGORY_META[category] || null;
  const notesParam = searchParams.get('notes') || '';

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [showFilters, setShowFilters] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [quickFilter, setQuickFilter] = useState('all');

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { leads: data } = await api.leads.list();
      setLeads(data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!detailLead) return;
    const updated = leads.find(l => l.row_number === detailLead.row_number);
    if (updated) setDetailLead(updated);
  }, [leads, detailLead?.row_number]);

  const handleQuickFilter = useCallback((id) => {
    setQuickFilter(id);
    if (id === 'active') {
      setFilters({ ...EMPTY_FILTERS, status: 'active' });
    } else if (id === 'archived') {
      setFilters({ ...EMPTY_FILTERS });
    } else if (id === 'all') {
      setFilters({ ...EMPTY_FILTERS });
    } else {
      setFilters({ ...EMPTY_FILTERS });
    }
  }, []);

  const filtered = useMemo(
    () => filterLeads(leads, { search, filters, category, notesParam, quickFilter }),
    [leads, search, filters, category, notesParam, quickFilter]
  );

  const handleStop = useCallback(async (lead) => {
    setActionLoading(p => ({ ...p, [`stop_${lead.row_number}`]: true }));
    try {
      const isStopped = lead.stop === 'yes';
      if (isStopped) {
        await api.leads.unstop(lead.row_number, lead.name);
        showToast(`${lead.name} — stop removed`);
      } else {
        await api.leads.stop(lead.row_number, lead.name);
        showToast(`${lead.name} — stop set. No more follow-ups.`, 'warn');
      }
      await load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(p => ({ ...p, [`stop_${lead.row_number}`]: false }));
    }
  }, [load, showToast]);

  const handleSaveEdit = useCallback(async (form) => {
    await api.leads.update(form.row_number, form);
    showToast(`${form.name} updated`);
    await load();
  }, [load, showToast]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <motion.div
      className="leads-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {(categoryMeta || notesParam) && (
        <div className="leads-banner">
          <span className="w-1 h-7 rounded-full bg-gs-accent shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gs-text">
              {categoryMeta?.label ?? (
                <>Template: <span className="uppercase">{notesParam}</span></>
              )}
            </h1>
            <p className="text-gs-muted text-xs truncate">
              {categoryMeta?.desc ?? 'Showing leads with this template'}
            </p>
          </div>
          <Link
            to="/leads"
            className="ml-auto text-xs text-gs-muted hover:text-gs-accent transition-colors shrink-0"
          >
            ← All leads
          </Link>
        </div>
      )}

      <LeadsToolbar
        search={search}
        onSearchChange={setSearch}
        filteredCount={filtered.length}
        loading={loading}
        onRefresh={load}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(p => !p)}
        filters={filters}
        onFiltersChange={setFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={() => setFilters({ ...EMPTY_FILTERS })}
        quickFilter={quickFilter}
        onQuickFilterChange={handleQuickFilter}
        category={category}
        notesParam={notesParam}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            className={`mx-6 mt-3 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 ${
              toast.type === 'error' ? 'bg-gs-danger/20 text-gs-danger' :
              toast.type === 'warn' ? 'bg-gs-warn/20 text-gs-warn' :
              'bg-gs-accent/20 text-gs-accent'
            }`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="leads-workspace-layout">
        <div className="leads-main">
          <div className="leads-table-shell leads-table-shell--split">
            <div className="leads-table-panel">
              {loading ? (
                <div className="flex justify-center py-20">
                  <Spinner />
                </div>
              ) : filtered.length === 0 ? (
                <LeadsEmptyState search={search} categoryMeta={categoryMeta} />
              ) : (
                <LeadsTable
                  data={filtered}
                  selectedRowNumber={detailLead?.row_number ?? null}
                  onRowClick={setDetailLead}
                  navigate={navigate}
                  onStop={handleStop}
                  onEdit={setEditLead}
                  actionLoading={actionLoading}
                />
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {detailLead && (
            <LeadDetailWorkspace
              lead={detailLead}
              onClose={() => setDetailLead(null)}
              onLeadUpdated={load}
            />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {editLead && (
          <EditLeadModal
            lead={editLead}
            onClose={() => setEditLead(null)}
            onSave={handleSaveEdit}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
