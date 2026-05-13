import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Send, AlertCircle, StopCircle, MessageSquare, Mail,
  Clock, TrendingUp, RefreshCw, ArrowRight, CheckCircle, XCircle, Shield
} from 'lucide-react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';

function StatCard({ icon: Icon, label, value, color = 'accent', link, loading, cardType }) {
  const colors = {
    accent: 'text-gs-accent bg-green-50 border-green-200',
    danger: 'text-gs-danger bg-red-50 border-red-200',
    warn:   'text-gs-warn   bg-amber-50 border-amber-200',
    info:   'text-gs-info   bg-blue-50 border-blue-200',
    purple: 'text-gs-purple bg-violet-50 border-violet-200',
    muted:  'text-gs-muted  bg-slate-100 border-slate-200'
  };

  const content = (
    <div className="card card-stat flex items-center gap-4 cursor-pointer">
      <div className={`p-3 rounded-xl shrink-0 border ${colors[color]}`}>
        <span className={`card-icon${cardType ? ` card-icon-${cardType}` : ''}`}>
          <Icon size={20} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-gs-muted text-xs mb-0.5 truncate font-medium">{label}</p>
        <p className="text-2xl font-bold text-gs-text tabular-nums tracking-tight">
          {loading ? <Spinner size={20} /> : <AnimatedNumber value={value} />}
        </p>
      </div>
      {link && <ArrowRight size={13} className="text-gs-muted ml-auto shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />}
    </div>
  );

  return link
    ? <Link to={link} className="group block">{content}</Link>
    : content;
}

function ActivityRow({ entry }) {
  const isError = entry.status === 'error';
  const isTest  = entry.testMode;

  return (
    <tr className="table-row">
      <td className="td">
        <div className="flex items-center gap-2">
          {isError
            ? <XCircle size={13} className="text-gs-danger shrink-0" />
            : <CheckCircle size={13} className="text-gs-accent shrink-0" />}
          <span className="capitalize text-gs-text font-medium">
            {entry.action?.replace(/_/g, ' ')}
          </span>
          {isTest && (
            <span className="text-gs-warn text-xs bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
              TEST
            </span>
          )}
        </div>
      </td>
      <td className="td text-gs-muted">{entry.leadName || '—'}</td>
      <td className="td">
        {entry.template && (
          <span className="bg-blue-50 border border-blue-200 text-gs-info text-xs px-2 py-0.5 rounded-full font-mono uppercase font-medium">
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
  const [leads, setLeads]       = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading]   = useState(true);

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
    total:        leads.length,
    stopped:      leads.filter(l => l.stop === 'yes').length,
    errors:       leads.filter(l => l.error && l.error.trim()).length,
    smsReplies:   leads.filter(l => l.sms_reply === 'yes').length,
    emailReplies: leads.filter(l => l.email_reply === 'yes').length,
    replied:      leads.filter(l => l.status === 'replied').length,
    active:       leads.filter(l => l.status === 'active' || (l.sent && l.sent !== 'imported' && l.stop !== 'yes')).length,
    sentToday:    leads.filter(l => {
      if (!l.sent || l.sent === 'imported') return false;
      const d = new Date(l.sent);
      return d.toDateString() === new Date().toDateString();
    }).length
  } : null;

  return (
    <div className="flex-1 overflow-y-auto">

      {/* Page header */}
      <div className="px-6 py-5 bg-white border-b border-gs-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gs-accent/10 border border-green-200 shrink-0">
            <Shield size={18} className="text-gs-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gs-text tracking-tight">Dashboard</h1>
            <p className="text-gs-muted text-xs mt-0.5">
              Green Shield Pest Solutions — Automation Control Center
            </p>
          </div>
        </div>
        <button onClick={refresh} className="btn-ghost text-xs gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="px-6 py-5 space-y-6 animate-fade-in-up">

        {/* Pipeline Overview */}
        <div>
          <p className="section-label">
            <span className="section-label-bar bg-gs-accent" />
            Pipeline Overview
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users}       label="Total Leads" value={stats?.total      ?? 0} color="accent" link="/leads"                  loading={loading} cardType="leads"   />
            <StatCard icon={Send}        label="Sent Today"  value={stats?.sentToday  ?? 0} color="info"   link="/leads?category=sent"    loading={loading} cardType="sent"    />
            <StatCard icon={AlertCircle} label="With Errors" value={stats?.errors     ?? 0} color="danger" link="/leads?category=errors"  loading={loading} cardType="errors"  />
            <StatCard icon={StopCircle}  label="Stopped"     value={stats?.stopped    ?? 0} color="warn"   link="/leads?category=stopped" loading={loading} cardType="stopped" />
          </div>
        </div>

        {/* Engagement */}
        <div>
          <p className="section-label">
            <span className="section-label-bar bg-gs-info" />
            Engagement
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={MessageSquare} label="SMS Replies"   value={stats?.smsReplies   ?? 0} color="accent" link="/leads?category=replies"    loading={loading} cardType="sms"      />
            <StatCard icon={Mail}          label="Email Replies" value={stats?.emailReplies ?? 0} color="purple" link="/leads?category=replies"    loading={loading} cardType="email"    />
            <StatCard icon={TrendingUp}    label="Replied"       value={stats?.replied      ?? 0} color="accent" link="/leads?category=replies"    loading={loading} cardType="replied"  />
            <StatCard icon={Clock}         label="In Progress"   value={stats?.active       ?? 0} color="info"   link="/leads?category=inprogress" loading={loading} cardType="progress" />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gs-text text-sm">Recent Activity</h2>
            <Link to="/activity" className="text-gs-accent text-xs hover:underline flex items-center gap-1 font-medium">
              View all <ArrowRight size={11} />
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

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/send" className="card hover:border-green-300 hover:shadow-md transition-all group cursor-pointer">
            <div className="p-2.5 rounded-xl bg-green-50 border border-green-200 w-fit mb-3 group-hover:scale-110 transition-transform duration-200">
              <Send size={16} className="text-gs-accent" />
            </div>
            <p className="font-semibold text-gs-text mb-1 text-sm">Send Template</p>
            <p className="text-gs-muted text-xs leading-relaxed">Choose a lead and send an AG, NA, RIT, T/M, or IQ template</p>
          </Link>
          <Link to="/leads" className="card hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 w-fit mb-3 group-hover:scale-110 transition-transform duration-200">
              <Users size={16} className="text-gs-info" />
            </div>
            <p className="font-semibold text-gs-text mb-1 text-sm">Manage Leads</p>
            <p className="text-gs-muted text-xs leading-relaxed">View, filter, stop, and edit all leads in the sheet</p>
          </Link>
          <Link to="/followups" className="card hover:border-amber-300 hover:shadow-md transition-all group cursor-pointer">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 w-fit mb-3 group-hover:scale-110 transition-transform duration-200">
              <Clock size={16} className="text-gs-warn" />
            </div>
            <p className="font-semibold text-gs-text mb-1 text-sm">Follow-ups</p>
            <p className="text-gs-muted text-xs leading-relaxed">See which leads are waiting on a follow-up response</p>
          </Link>
        </div>

      </div>
    </div>
  );
}
