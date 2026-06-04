import { motion } from 'motion/react';

function scoreTier(score) {
  if (score >= 70) return 'high';
  if (score >= 45) return 'mid';
  return 'low';
}

function ScoreBar({ score, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const tier = scoreTier(score);

  return (
    <div className="rf-score-bar">
      <div className="rf-score-bar__track">
        <motion.div
          className={`rf-score-bar__fill rf-score-bar__fill--${tier}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className={`rf-score-bar__value rf-score-bar__value--${tier}`}>{score}</span>
    </div>
  );
}

export default ScoreBar;
