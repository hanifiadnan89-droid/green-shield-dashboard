export default function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-5">

      {/* Bento metric row */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 p-card rounded-2xl p-5 h-36 flex flex-col justify-between">
          <div className="skeleton h-9 w-9 rounded-xl" />
          <div>
            <div className="skeleton h-9 w-16 mb-2" />
            <div className="skeleton h-3 w-24" />
          </div>
        </div>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="col-span-2 p-card rounded-2xl p-5 h-36 flex flex-col justify-between">
            <div className="skeleton h-9 w-9 rounded-xl" />
            <div>
              <div className="skeleton h-7 w-12 mb-2" />
              <div className="skeleton h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Middle: pipeline + quick actions */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-5 p-card rounded-2xl p-5">
          <div className="skeleton h-4 w-36 mb-5" />
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 mb-4">
              <div className="skeleton h-3 w-8 shrink-0" />
              <div className="skeleton h-2.5 flex-1 rounded-full" />
              <div className="skeleton h-3 w-6 shrink-0" />
            </div>
          ))}
        </div>
        <div className="col-span-7 p-card rounded-2xl p-5">
          <div className="skeleton h-4 w-28 mb-5" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: lead list + activity */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-8 p-card rounded-2xl p-5">
          <div className="skeleton h-4 w-32 mb-5" />
          <div className="flex gap-2 mb-4">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton h-7 w-20 rounded-full" />
            ))}
          </div>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-50">
              <div className="skeleton h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1">
                <div className="skeleton h-3 w-36 mb-1.5" />
                <div className="skeleton h-2.5 w-24" />
              </div>
              <div className="skeleton h-5 w-12 rounded-full" />
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
        <div className="col-span-4 p-card rounded-2xl p-5">
          <div className="skeleton h-4 w-28 mb-5" />
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex gap-3 mb-4">
              <div className="skeleton h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 pt-1">
                <div className="skeleton h-3 w-full mb-1.5" />
                <div className="skeleton h-2.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
