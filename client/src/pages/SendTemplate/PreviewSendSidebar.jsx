import { motion } from 'motion/react';
import { Check, FileText, ExternalLink, Rocket, AlertTriangle } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import { CHANNELS } from './constants.js';
import {
  buildLaunchChecklist,
  computeFinalQuote,
  formatMoney,
  parseMoney,
} from './previewSendUtils.js';

const EASE = [0.22, 1, 0.36, 1];

export default function PreviewSendSidebar({
  selectedLead,
  selectedTemplate,
  selectedPrepGuides,
  quoteState,
  selectedChannel,
  onChannelChange,
  quotes,
  selectedQuote,
  onToggleQuote,
  testMode,
  sending,
  stopBlocked,
  onBack,
  onSend,
}) {
  const configuredQuotes = quotes.filter(q => q.configured);
  const checklist = buildLaunchChecklist({
    selectedLead,
    selectedTemplate,
    selectedPrepGuides,
    quoteDocSelected: !!quoteState?.selected,
    selectedQuote,
    selectedChannel,
    stopBlocked,
  });
  const pricing = quoteState?.pricing || {};
  const finalTotal = computeFinalQuote(pricing);
  const prepCount = selectedPrepGuides?.size || 0;

  return (
    <aside className="send-preview-sidebar">
      <div className="send-preview-sidebar__scroll">
        <motion.section
          className="send-preview-sidebar__block"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <h3 className="send-preview-sidebar__heading">Launch checklist</h3>
          <ul className="send-preview-checklist">
            {checklist.map((item, i) => (
              <motion.li
                key={item.id}
                className={`send-preview-checklist__item ${item.ok ? 'send-preview-checklist__item--ok' : ''}`}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + i * 0.04, duration: 0.25, ease: EASE }}
              >
                <span className={`send-preview-checklist__icon ${item.ok ? 'send-preview-checklist__icon--ok' : ''}`}>
                  {item.ok ? <Check size={12} strokeWidth={3} /> : null}
                </span>
                <span className={item.optional ? 'text-gs-muted' : ''}>{item.label}</span>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          className="send-preview-sidebar__block"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08, duration: 0.35, ease: EASE }}
        >
          <h3 className="send-preview-sidebar__heading">Pricing summary</h3>
          <div className="send-preview-pricing">
            <div className="send-preview-pricing__row">
              <span>Initial quote</span>
              <span>{formatMoney(pricing.initial) || '—'}</span>
            </div>
            <div className="send-preview-pricing__row send-preview-pricing__row--discount">
              <span>Discount</span>
              <span>
                {parseMoney(pricing.discounted) > 0
                  ? `-${formatMoney(pricing.discounted)}`
                  : '—'}
              </span>
            </div>
            {pricing.recurring && (
              <div className="send-preview-pricing__row">
                <span>Recurring</span>
                <span>{formatMoney(pricing.recurring)}/mo</span>
              </div>
            )}
            <div className="send-preview-pricing__total">
              <span>Final total</span>
              <span>{pricing.initial ? formatMoney(finalTotal) : '—'}</span>
            </div>
          </div>
          <p className="text-[10px] text-gs-muted mt-2">Edit amounts in Documents panel</p>
        </motion.section>

        <motion.section
          className="send-preview-sidebar__block"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.35, ease: EASE }}
        >
          <h3 className="send-preview-sidebar__heading">Attachment summary</h3>
          <div className="text-xs text-gs-text space-y-1.5">
            <p>Prep guides: <strong>{prepCount}</strong></p>
            <p>Quote template: <strong>{quoteState?.selected?.name || 'None'}</strong></p>
            <p>Drive quote: <strong>{selectedQuote?.label || 'None'}</strong></p>
          </div>
        </motion.section>

        <motion.section
          className="send-preview-sidebar__block"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.16, duration: 0.35, ease: EASE }}
        >
          <h3 className="send-preview-sidebar__heading">Send channel</h3>
          <div className="send-preview-channels">
            {CHANNELS.map(c => (
              <motion.button
                key={c.code}
                type="button"
                onClick={() => onChannelChange(c.code)}
                className={`send-preview-channel ${selectedChannel === c.code ? 'send-preview-channel--active' : ''}`}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <p className="font-semibold text-xs">{c.label}</p>
                <p className="text-[10px] opacity-80 mt-0.5">{c.desc}</p>
              </motion.button>
            ))}
          </div>
        </motion.section>

        {configuredQuotes.length > 0 && (
          <motion.section
            className="send-preview-sidebar__block"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.35, ease: EASE }}
          >
            <h3 className="send-preview-sidebar__heading">Drive quote (optional)</h3>
            <div className="space-y-2">
              {quotes.map(q => (
                <motion.button
                  key={q.type}
                  type="button"
                  onClick={() => onToggleQuote(q)}
                  disabled={!q.configured}
                  className={`send-preview-drive-quote w-full text-left ${
                    selectedQuote?.type === q.type ? 'send-preview-drive-quote--on' : ''
                  }`}
                  whileHover={q.configured ? { y: -1 } : {}}
                >
                  <FileText size={14} className="shrink-0" />
                  <span className="text-xs font-medium truncate">{q.label}</span>
                </motion.button>
              ))}
            </div>
            {selectedQuote?.url && (
              <a
                href={selectedQuote.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-gs-info text-xs mt-2 hover:underline"
              >
                <ExternalLink size={11} />
                Open in Drive
              </a>
            )}
          </motion.section>
        )}

        {testMode && (
          <div className="send-preview-sidebar__test">
            <strong>TEST MODE</strong> — simulated send only
          </div>
        )}
      </div>

      <div className="send-preview-sidebar__actions">
        {stopBlocked && (
          <p className="text-xs text-gs-danger flex items-start gap-2 mb-3">
            <AlertTriangle size={14} className="shrink-0" />
            Lead is stopped — cannot launch sequence
          </p>
        )}
        <div className="flex gap-2">
          <motion.button
            type="button"
            className="send-command-ghost shrink-0"
            onClick={onBack}
            whileTap={{ scale: 0.98 }}
          >
            Back
          </motion.button>
          <motion.button
            type="button"
            className="send-preview-launch-btn flex-1"
            onClick={onSend}
            disabled={sending || stopBlocked}
            whileHover={sending || stopBlocked ? {} : { y: -2, boxShadow: '0 12px 32px rgba(22,163,74,0.35)' }}
            whileTap={sending || stopBlocked ? {} : { scale: 0.98 }}
          >
            {sending ? (
              <>
                <Spinner size={16} />
                Launching…
              </>
            ) : (
              <>
                <Rocket size={18} />
                {testMode ? 'Launch (Test)' : 'Launch sequence'}
              </>
            )}
          </motion.button>
        </div>
      </div>
    </aside>
  );
}
