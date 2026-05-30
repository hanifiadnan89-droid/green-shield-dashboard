import { CheckCircle, XCircle } from 'lucide-react';

export default function SendResultScreen({ result, onReset }) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 animate-fade-in-up">
      <div className="max-w-lg mx-auto">
        <div
          className={`card text-center py-10 ${
            result.success ? 'border-gs-accent/50' : 'border-gs-danger/50'
          }`}
        >
          {result.success
            ? <CheckCircle size={48} className="text-gs-accent mx-auto mb-4" />
            : <XCircle size={48} className="text-gs-danger mx-auto mb-4" />}
          <h2 className="text-xl font-bold text-gs-text mb-2">
            {result.success ? (result.testMode ? 'Test Simulated' : 'Sent!') : 'Send Failed'}
          </h2>
          <p className="type-body-sm text-gs-muted mb-1">{result.message || result.error}</p>
          {result.testMode && (
            <p className="type-label-sm text-gs-warn mt-2 font-normal tracking-normal">
              This was a test. Set TEST_MODE=false in .env to send for real.
            </p>
          )}
          <div className="flex gap-3 justify-center mt-6">
            <button type="button" onClick={onReset} className="btn-ghost">
              Send Another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
