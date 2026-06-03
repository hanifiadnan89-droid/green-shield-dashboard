import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, FileText, BookOpen, Check, AlertTriangle, Image } from 'lucide-react';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

/* ── Prep Guides Section ── */
export default function PrepGuidesSection({ selected, onToggle, variant = 'default' }) {
  const [files, setFiles]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.documents.prepGuides().then(data => {
      setFiles(data.prepGuides || []);
      setMissing(!!data.missing);
    }).catch(() => setFiles([])).finally(() => setLoading(false));
  }, []);

  const shellClass = variant === 'preview' ? 'send-doc-panel' : 'card flex flex-col gap-0 p-0 overflow-hidden';

  return (
    <div className={shellClass}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gs-border flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-gs-info/12 border border-gs-info/20">
          <BookOpen size={14} className="text-gs-info" />
        </div>
        <div>
          <p className="text-gs-text font-semibold text-sm">Prep Guides</p>
          <p className="text-gs-muted text-xs">~/Desktop/Prep Guide</p>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 flex-1">
        {loading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : missing ? (
          <div className="text-gs-warn text-xs bg-gs-warn/10 border border-gs-warn/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle size={12} /> Folder not found: ~/Desktop/Prep Guide
          </div>
        ) : files?.length === 0 ? (
          <p className="text-gs-muted text-xs py-2 text-center">No files found in Prep Guide folder</p>
        ) : (
          <>
            <p className="text-gs-muted text-xs">Select prep guides to attach (optional)</p>
            <div className="space-y-2">
              {files.map((f, i) => {
                const isSelected = selected.has(f.index);
                const isPdf = f.type === 'pdf';
                const FileIcon = isPdf ? FileText : Image;
                return (
                  <motion.button
                    key={i}
                    type="button"
                    onClick={() => onToggle(f.index)}
                    className={`send-doc-card ${isSelected ? 'send-doc-card--selected send-doc-card--info' : ''}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <span className="send-doc-card__shimmer" aria-hidden />
                    <div className={`send-doc-card__check ${isSelected ? 'send-doc-card__check--on send-doc-card__check--info' : ''}`}>
                      {isSelected && <Check size={10} strokeWidth={3} />}
                    </div>
                    <FileIcon size={16} className="shrink-0 text-gs-info opacity-80" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gs-text truncate">{f.name}</p>
                      <p className="text-[10px] text-gs-muted uppercase tracking-wide mt-0.5">
                        {isPdf ? 'PDF document' : 'Image'}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gs-border">
        {selected.size > 0 ? (
          <p className="text-gs-accent text-xs font-medium flex items-center gap-1.5">
            <CheckCircle size={12} /> {selected.size} guide{selected.size !== 1 ? 's' : ''} selected
          </p>
        ) : (
          <p className="text-gs-muted text-xs">No prep guides selected (optional)</p>
        )}
      </div>
    </div>
  );
}
