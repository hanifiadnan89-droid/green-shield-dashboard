import { motion } from 'motion/react';

const ORBS = [
  { size: 420, x: '-10%', y: '-20%', color: 'rgba(74,222,128,0.14)', dur: 18 },
  { size: 320, x: '70%', y: '10%', color: 'rgba(34,197,94,0.1)', dur: 22 },
  { size: 280, x: '40%', y: '75%', color: 'rgba(163,230,53,0.08)', dur: 16 },
  { size: 200, x: '85%', y: '60%', color: 'rgba(56,189,248,0.06)', dur: 20 },
];

export default function AmbientBackground() {
  return (
    <div className="pc-ambient" aria-hidden>
      <motion.div
        className="pc-ambient__mesh"
        animate={{
          backgroundPosition: ['0% 0%', '100% 50%', '0% 100%', '0% 0%'],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
      />
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className="pc-ambient__orb"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
          }}
          animate={{
            x: [0, 24, -12, 0],
            y: [0, -18, 12, 0],
            scale: [1, 1.08, 0.96, 1],
          }}
          transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div className="pc-ambient__grid" />
    </div>
  );
}
