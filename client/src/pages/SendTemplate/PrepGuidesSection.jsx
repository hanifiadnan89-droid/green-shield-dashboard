import { useEffect, useState } from 'react';
import { CheckCircle, FileText, BookOpen, Check, AlertTriangle, Image } from 'lucide-react';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

/* ── Prep Guides Section ── */
export default function PrepGuidesSection({ selected, onToggle }) {
  const [files, setFiles]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.documents.prepGuides().then(data => {
      setFiles(data.prepGuides || []);
      setMissing(!!data.missing);
    }).catch(() => setFiles([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="card flex flex-col gap-0 p-0 overflow-hidden">
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
            <div className="space-y-1.5">
              {files.map((f, i) => {
                const isSelected = selected.has(f.index);
                const isPdf  = f.type === 'pdf';
                const FileIcon = isPdf ? FileText : Image;
                return (
                  <button
                    key={i}
                    onClick={() => onToggle(f.index)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gs-info/12 border border-gs-info/30 text-gs-info'
                        : 'bg-gs-bg border border-gs-border text-gs-text hover:border-gs-muted/40'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-gs-info border-gs-info' : 'border-gs-border'
                    }`}>
                      {isSelected && <Check size={10} className="text-black" />}
                    </div>
                    <FileIcon size={12} className="shrink-0 opacity-60" />
                    <span className="truncate font-medium">{f.name}</span>
                    <span className={`ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${
                      isPdf ? 'text-gs-muted border-gs-border/60' : 'text-gs-purple border-gs-purple/20 bg-gs-purple/8'
                    }`}>
                      {isPdf ? 'PDF' : 'IMG'}
                    </span>
                  </button>
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
