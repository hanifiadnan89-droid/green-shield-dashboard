import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';

export default function EditLeadModal({ lead, onClose, onSave }) {
  const [form, setForm] = useState({ ...lead });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/55 backdrop-blur-md flex items-center justify-center z-[70] p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass-panel rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gs-border">
            <h3 className="font-semibold text-gs-text">Edit Lead — {lead.name}</h3>
            <button type="button" onClick={onClose} className="text-gs-muted hover:text-gs-text cursor-pointer">
              <X size={16} />
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            {['name', 'email', 'phone', 'notes', 'status'].map(field => (
              <div key={field}>
                <label className="label">{field}</label>
                <input
                  className="input"
                  value={form[field] || ''}
                  onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label className="label">stop</label>
              <select
                className="select"
                value={form.stop || ''}
                onChange={e => setForm(p => ({ ...p, stop: e.target.value }))}
              >
                <option value="">No</option>
                <option value="yes">Yes — stop follow-ups</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-gs-border">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving && <Spinner size={14} />} Save Changes
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
