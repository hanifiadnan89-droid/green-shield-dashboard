import { useCallback, useState } from 'react';
import { Building2, Database, Loader2 } from 'lucide-react';
import { api } from '../../../api/client.js';
import { buildRentCastAddress } from '../../../utils/intake/buildRentCastAddress.js';
import IntakeRentCastConfirmModal from './IntakeRentCastConfirmModal.jsx';
import IntakeRentCastUsageModal from './IntakeRentCastUsageModal.jsx';
import IntakePropertyRecordsPanel from './IntakePropertyRecordsPanel.jsx';

export default function IntakePropertyRecordsSection({
  customer,
  records,
  onRecordsChange,
  loading = false,
  onLoadingChange,
  error = null,
  onErrorChange,
  status = 'idle',
  onStatusChange,
}) {
  const [usageOpen, setUsageOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [pendingUsage, setPendingUsage] = useState(null);

  const addressPayload = buildRentCastAddress(customer);

  const runLookup = useCallback(async ({ confirmPaidLookup = false } = {}) => {
    if (!addressPayload.address && !(addressPayload.street && addressPayload.city && addressPayload.state && addressPayload.zip)) {
      onErrorChange?.('A verified address is required before looking up property records.');
      onStatusChange?.('unavailable');
      return;
    }

    onLoadingChange?.(true);
    onErrorChange?.(null);

    try {
      const result = await api.intake.propertyRecords({
        ...addressPayload,
        confirmPaidLookup,
      });

      if (result.requiresConfirmation) {
        setPendingUsage(result.usage);
        setConfirmOpen(true);
        return;
      }

      if (result.usage) setUsage(result.usage);

      if (!result.records || result.records.unavailable) {
        onRecordsChange?.(null);
        onStatusChange?.('unavailable');
        return;
      }

      onRecordsChange?.({ ...result.records, cached: result.cached });
      onStatusChange?.('loaded');
    } catch (err) {
      onRecordsChange?.(null);
      onErrorChange?.(err.message || 'Property records lookup failed.');
      onStatusChange?.('unavailable');
      if (err.usage) setUsage(err.usage);
    } finally {
      onLoadingChange?.(false);
      setConfirming(false);
      setConfirmOpen(false);
      setPendingUsage(null);
    }
  }, [addressPayload, onRecordsChange, onLoadingChange, onErrorChange, onStatusChange]);

  async function handleLookupClick() {
    await runLookup({ confirmPaidLookup: false });
  }

  async function handleConfirmPaidLookup() {
    setConfirming(true);
    await runLookup({ confirmPaidLookup: true });
  }

  async function handleUsageClick() {
    setUsageOpen(true);
    setUsageLoading(true);
    setUsageError(null);
    try {
      const { usage: nextUsage } = await api.intake.propertyRecordsUsage();
      setUsage(nextUsage);
    } catch (err) {
      setUsageError(err.message || 'Could not load API usage.');
    } finally {
      setUsageLoading(false);
    }
  }

  return (
    <section className="intake-preview-panel__section intake-preview-panel__section--compact intake-preview-panel__section--records">
      <div className="intake-property-records__preview-header">
        <h3><Database size={14} /> Property Records</h3>
        <div className="intake-property-records__actions">
          <button
            type="button"
            className="intake-secondary-btn intake-property-records__usage-btn"
            onClick={handleUsageClick}
          >
            API Usage
          </button>
          <button
            type="button"
            className="intake-primary-btn intake-property-records__lookup-btn"
            onClick={handleLookupClick}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Looking up…
              </>
            ) : (
              <>
                <Building2 size={14} />
                Lookup Property Records
              </>
            )}
          </button>
        </div>
      </div>

      <IntakePropertyRecordsPanel
        records={records}
        loading={loading}
        error={error}
        status={status}
      />

      <IntakeRentCastConfirmModal
        open={confirmOpen}
        usage={pendingUsage || usage}
        onCancel={() => {
          if (!confirming) {
            setConfirmOpen(false);
            setPendingUsage(null);
          }
        }}
        onConfirm={handleConfirmPaidLookup}
        confirming={confirming}
      />

      <IntakeRentCastUsageModal
        open={usageOpen}
        usage={usage}
        loading={usageLoading}
        error={usageError}
        onClose={() => setUsageOpen(false)}
      />
    </section>
  );
}
