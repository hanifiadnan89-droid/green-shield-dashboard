import { motion } from 'motion/react';

const ORBS = [
  { size: 380, x: '-8%', y: '-15%', color: 'rgba(74,222,128,0.12)', dur: 19 },
  { size: 300, x: '72%', y: '8%', color: 'rgba(34,197,94,0.09)', dur: 23 },
  { size: 260, x: '35%', y: '78%', color: 'rgba(163,230,53,0.07)', dur: 17 },
  { size: 180, x: '88%', y: '55%', color: 'rgba(56,189,248,0.05)', dur: 21 },
];

export default function RepliesAmbientBackground() {
  return (
    <div className="rc-ambient" aria-hidden>
      <motion.div
        className="rc-ambient__mesh"
        animate={{ backgroundPosition: ['0% 0%', '100% 50%', '0% 100%', '0% 0%'] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
      />
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className="rc-ambient__orb"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
          }}
          animate={{
            x: [0, 20, -10, 0],
            y: [0, -16, 10, 0],
            scale: [1, 1.06, 0.97, 1],
          }}
          transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div className="rc-ambient__grid" />
    </div>
  );
}
