import { motion } from 'motion/react';

const ORBS = [
  { size: 420, x: '-10%', y: '-18%', color: 'rgba(74,222,128,0.14)', dur: 20 },
  { size: 320, x: '70%', y: '5%', color: 'rgba(34,197,94,0.1)', dur: 24 },
  { size: 280, x: '40%', y: '75%', color: 'rgba(163,230,53,0.08)', dur: 18 },
];

export default function LeadsAmbientBackground() {
  return (
    <div className="lc-ambient" aria-hidden>
      <motion.div
        className="lc-ambient__mesh"
        animate={{ backgroundPosition: ['0% 0%', '100% 50%', '0% 0%'] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
      />
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className="lc-ambient__orb"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
          }}
          animate={{ x: [0, 18, -8, 0], y: [0, -14, 8, 0] }}
          transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div className="lc-ambient__grid" />
    </div>
  );
}
