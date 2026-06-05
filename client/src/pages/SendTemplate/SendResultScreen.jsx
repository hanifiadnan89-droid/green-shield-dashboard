import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';

export default function SendResultScreen({ result, onReset }) {
  return (
    <div className="send-result-screen">
      <motion.div
        className={`send-result-card ${result.success ? '' : 'send-result-card--error'}`}
        initial={{ opacity: 0.94, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        {result.success
          ? <CheckCircle size={48} className="text-[#4ade80] mx-auto mb-4" />
          : <XCircle size={48} className="text-red-400 mx-auto mb-4" />}
        <h2>
          {result.success ? (result.testMode ? 'Test Simulated' : 'Workflow launched!') : 'Send Failed'}
        </h2>
        <p>{result.message || result.error}</p>
        {result.testMode && (
          <p className="text-amber-400/80 text-xs mt-2">
            This was a test. Set TEST_MODE=false in .env to send for real.
          </p>
        )}
        <motion.button
          type="button"
          onClick={onReset}
          className="send-launch-cta mt-6 max-w-xs mx-auto"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          Launch another
        </motion.button>
      </motion.div>
    </div>
  );
}
