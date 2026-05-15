import { Users, Send, MessageSquare, AlertCircle, StopCircle } from 'lucide-react';
import MetricCard from './MetricCard.jsx';

export default function BentoGrid({ stats, loading, activeFilter, onFilterChange }) {
  const replied = (stats?.smsReplies ?? 0) + (stats?.emailReplies ?? 0);

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Hero: Total Leads */}
      <div className="col-span-4">
        <MetricCard
          label="Total Leads"
          value={stats?.total ?? 0}
          icon={Users}
          color="green"
          hero
          loading={loading}
          subtitle={stats?.inProgress > 0 ? `${stats.inProgress} in progress` : 'All leads in pipeline'}
          filterKey="all"
          onFilterChange={onFilterChange}
          isActive={activeFilter === 'all'}
        />
      </div>

      {/* Sent Today */}
      <div className="col-span-2">
        <MetricCard
          label="Sent Today"
          value={stats?.sentToday ?? 0}
          icon={Send}
          color="blue"
          loading={loading}
          filterKey="sent"
          onFilterChange={onFilterChange}
          isActive={activeFilter === 'sent'}
        />
      </div>

      {/* Replies (SMS + Email) */}
      <div className="col-span-2">
        <MetricCard
          label="Replies"
          value={replied}
          icon={MessageSquare}
          color="purple"
          loading={loading}
          subtitle={
            !loading && replied > 0
              ? `${stats?.smsReplies ?? 0} SMS · ${stats?.emailReplies ?? 0} email`
              : undefined
          }
          filterKey="replied"
          onFilterChange={onFilterChange}
          isActive={activeFilter === 'replied'}
        />
      </div>

      {/* Errors — urgent */}
      <div className="col-span-2">
        <MetricCard
          label="Errors"
          value={stats?.errors ?? 0}
          icon={AlertCircle}
          color="red"
          urgent
          loading={loading}
          subtitle={!loading && stats?.errors > 0 ? 'Needs attention' : undefined}
          filterKey="errors"
          onFilterChange={onFilterChange}
          isActive={activeFilter === 'errors'}
        />
      </div>

      {/* Stopped */}
      <div className="col-span-2">
        <MetricCard
          label="Stopped"
          value={stats?.stopped ?? 0}
          icon={StopCircle}
          color="amber"
          loading={loading}
          filterKey="stopped"
          onFilterChange={onFilterChange}
          isActive={activeFilter === 'stopped'}
        />
      </div>
    </div>
  );
}
