import { motion } from 'motion/react';

function Skel({ className = '' }) {
  return (
    <motion.div
      className={`rc-skel ${className}`.trim()}
      animate={{ opacity: [0.4, 0.75, 0.4] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export default function RepliesLoadingSkeleton() {
  return (
    <div className="rc-skel-layout flex-1 p-4 gap-4">
      <Skel className="rc-skel--header" />
      <div className="flex flex-1 gap-4 min-h-0">
        <div className="hidden lg:flex flex-col gap-3 w-[380px] shrink-0">
          <Skel className="h-10 rounded-xl" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skel key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
        <Skel className="flex-1 rounded-2xl min-h-[320px]" />
      </div>
    </div>
  );
}
