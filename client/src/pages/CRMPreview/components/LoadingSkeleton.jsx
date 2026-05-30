export default function LoadingSkeleton() {
  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-5">

      {/* KPI bar — matches SalesSummaryBar: 1 col → 2 col → 4 col */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="p-card rounded-2xl p-5 flex items-center gap-4">
            <div className="skeleton h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="skeleton h-8 w-14 mb-2" />
              <div className="skeleton h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline summary — always full width */}
      <div className="p-card rounded-2xl p-5 lg:p-8">
        <div className="skeleton h-4 w-40 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex flex-col items-center gap-3">
              <div className="skeleton h-24 w-24 rounded-full" />
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-3 w-16" />
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="p-card rounded-xl p-3">
              <div className="skeleton h-6 w-10 mb-1.5" />
              <div className="skeleton h-2.5 w-14" />
            </div>
          ))}
        </div>
      </div>

      {/* Lead list + Route Finder — matches lg:grid-cols-12 split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">

        {/* Lead pipeline — lg:col-span-8 */}
        <div className="lg:col-span-8 p-card rounded-2xl p-5">
          <div className="skeleton h-4 w-32 mb-4" />
          <div className="skeleton h-9 w-full rounded-xl mb-3" />
          {/* Filter chips — wrapping row */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton h-7 w-16 rounded-full" />
            ))}
          </div>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-50">
              <div className="skeleton h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="skeleton h-3 w-32 mb-1.5" />
                <div className="skeleton h-2.5 w-24" />
              </div>
              <div className="skeleton h-5 w-12 rounded-full shrink-0" />
              <div className="hidden sm:block skeleton h-5 w-14 rounded-full shrink-0" />
            </div>
          ))}
        </div>

        {/* Route Finder — lg:col-span-4 */}
        <div className="lg:col-span-4 p-card rounded-2xl p-5">
          <div className="skeleton h-4 w-28 mb-4" />
          <div className="flex flex-wrap gap-2 mb-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton h-9 rounded-xl" style={{ flex: '1 1 calc(33% - 4px)' }} />
            ))}
          </div>
          <div className="skeleton h-9 w-full rounded-xl mb-3" />
          <div className="flex gap-2 mb-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton h-9 flex-1 rounded-xl" />
            ))}
          </div>
          {[0, 1, 2].map(i => (
            <div key={i} className="p-card rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="skeleton h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1">
                  <div className="skeleton h-3 w-24 mb-1" />
                  <div className="skeleton h-2.5 w-16" />
                </div>
              </div>
              <div className="skeleton h-2 w-full rounded-full" />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
