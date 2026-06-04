import { motion } from 'motion/react';

function Block({ className = '', delay = 0 }) {
  return (
    <motion.div
      className={`pc-skel ${className}`}
      animate={{ opacity: [0.35, 0.65, 0.35] }}
      transition={{ duration: 1.8, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

export default function CommandLoadingSkeleton() {
  return (
    <div className="pipeline-command pipeline-command--fullscreen">
      <div className="pipeline-command__grid pc-skel-layout">
        <Block className="pc-skel--header" />
        <div className="pc-skel-kpi-row">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <Block key={i} className="pc-skel--kpi" delay={i * 0.08} />
          ))}
          <Block className="pc-skel--services" delay={0.2} />
        </div>
        <div className="pc-skel-mid">
          <Block className="pc-skel--flow" delay={0.1} />
          <Block className="pc-skel--followups" delay={0.15} />
          <Block className="pc-skel--chart" delay={0.2} />
        </div>
        <Block className="pc-skel--feed" delay={0.28} />
      </div>
    </div>
  );
}
