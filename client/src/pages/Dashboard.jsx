import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Send, AlertCircle, StopCircle, MessageSquare, Mail,
  Clock, TrendingUp, RefreshCw, ArrowRight, CheckCircle, XCircle
} from 'lucide-react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';

function StatCard({ icon: Icon, label, value, color = 'accent', link, loading }) {
  const colors = {
    accent: 'text-gs-accent bg-gs-accent/10',
    danger: 'text-gs-danger bg-gs-danger/10',
    warn: 'text-gs-warn bg-gs-warn/10',
    info: 'text-gs-info bg-gs-info/10',
    purple: 'text-purple-400 bg-purple-500/10',
    muted: 'text-gs-muted bg-gs-muted/10'
  };

  const content = (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-gs-muted text-xs mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gs-text">
          {loading ? <Spinner size={20} /> : value}
        </p>
      </div>
      {link && <ArrowRight size={14} className="text-gs-muted ml-auto" />}
    </div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
}

function ActivityRow({ entry }) {
  const isError = entry.status === 'error';
  const isTest = entry.testMode;

  return (
    <tr className="table-row">
      <td className="td">
        <div className="flex items-center gap-2">
          {isError
            ? <XCircle size={14} className="text-gs-danger shrink-0" />
            : <CheckCircle size={14} className="text-gs-accent shrink-0" />}
          <span className="capitalize">{entry.action?.replace(/_/g, ' ')}</span>
          {isTest && <span className="text-gs-warn text-xs">[TEST]</span>}
        </div>
      </td>
      <td className="td text-gs-muted">{entry.leadName || '—'}</td>
      <td className="td">
        {entry.template && (
          <span className="bg-gs-info/20 text-gs-info text-xs px-2 py-0.5 rounded font-mono uppercase">
            {entry.template}
          </span>
        )}
      </td>
      <td className="td text-gs-muted text-xs">
        {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
      </td>
    </tr>
  );
}

export default function Dashboard({ testMode }) {
  const [leads, setLeads] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [leadsData, activityData] = await Promise.all([
        api.leads.list(),
        api.activity.list(10)
      ]);
      setLeads(leadsData.leads || []);
      setActivity(activityData.log || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const stats = leads ? {
    total: leads.length,
    stopped: leads.filter(l => l.stop === 'yes').length,
    errors: leads.filter(l => l.error && l.error.trim()).length,
    smsReplies: leads.filter(l => l.sms_reply === 'yes').length,
    emailReplies: leads.filter(l => l.email_reply === 'yes').length,
    replied: leads.filter(l => l.status === 'replied').length,
    active: leads.filter(l => l.status === 'active' || (l.sent && l.sent !== 'imported' && l.stop !== 'yes')).length,
    sentToday: leads.filter(l => {
      if (!l.sent || l.sent === 'imported') return false;
      const d = new Date(l.sent);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length
  } : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-5 border-b border-gs-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gs-text">Dashboard</h1>
          <p className="text-gs-muted text-xs mt-0.5">Green Shield Pest Solutions — Automation Control Center</p>
        </div>
        <button onClick={refresh} className="btn-ghost text-xs gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="px-6 py-5 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Leads" value={stats?.total ?? 0} color="accent" link="/leads" loading={loading} />
          <StatCard icon={Send} label="Sent Today" value={stats?.sentToday ?? 0} color="info" link="/leads?category=sent" loading={loading} />
          <StatCard icon={AlertCircle} label="With Errors" value={stats?.errors ?? 0} color="danger" link="/leads?category=errors" loading={loading} />
          <StatCard icon={StopCircle} label="Stopped" value={stats?.stopped ?? 0} color="warn" link="/leads?category=stopped" loading={loading} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={MessageSquare} label="SMS Replies" value={stats?.smsReplies ?? 0} color="accent" link="/leads?category=replies" loading={loading} />
          <StatCard icon={Mail} label="Email Replies" value={stats?.emailReplies ?? 0} color="purple" link="/leads?category=replies" loading={loading} />
          <StatCard icon={TrendingUp} label="Replied" value={stats?.replied ?? 0} color="accent" link="/leads?category=replies" loading={loading} />
          <StatCard icon={Clock} label="In Progress" value={stats?.active ?? 0} color="info" link="/leads?category=inprogress" loading={loading} />
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gs-text">Recent Activity</h2>
            <Link to="/activity" className="text-gs-accent text-xs hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : activity?.length === 0 ? (
            <p className="text-gs-muted text-sm text-center py-8">No activity yet. Start by sending a template.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gs-border">
                    <th className="th">Action</th>
                    <th className="th">Lead</th>
                    <th className="th">Template</th>
                    <th className="th">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activity?.map(e => <ActivityRow key={e.id} entry={e} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/send" className="card hover:border-gs-accent/50 transition-colors group">
            <Send size={20} className="text-gs-accent mb-3" />
            <p className="font-semibold text-gs-text mb-1">Send Template</p>
            <p className="text-gs-muted text-sm">Choose a lead and send an AG, NA, RIT, T/M, or IQ template</p>
          </Link>
          <Link to="/leads" className="card hover:border-gs-info/50 transition-colors group">
            <Users size={20} className="text-gs-info mb-3" />
            <p className="font-semibold text-gs-text mb-1">Manage Leads</p>
            <p className="text-gs-muted text-sm">View, filter, stop, and edit all leads in the sheet</p>
          </Link>
          <Link to="/followups" className="card hover:border-gs-warn/50 transition-colors group">
            <Clock size={20} className="text-gs-warn mb-3" />
            <p className="font-semibold text-gs-text mb-1">Follow-ups</p>
            <p className="text-gs-muted text-sm">See which leads are waiting on a follow-up response</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
