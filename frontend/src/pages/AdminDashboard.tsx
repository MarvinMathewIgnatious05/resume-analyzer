import { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, ShieldCheck, Activity, Users, FileWarning, KeyRound } from 'lucide-react';
import axios from 'axios';

interface Session {
  device_hash: string;
  ip: string;
  user_agent: string;
  last_active: string;
  is_current: boolean;
}

interface AuditLog {
  id: number;
  email: string;
  event_type: string;
  description: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

interface Metrics {
  total_users: number;
  active_users_today: number;
  total_resumes_uploaded: number;
  virus_scan_metrics: {
    total_scanned: number;
    clean: number;
    flagged: number;
  };
  recent_audit_logs: AuditLog[];
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchAdminData = async () => {
    const token = localStorage.getItem('access_token');
    try {
      const [metricsResp, sessionsResp] = await Promise.all([
        axios.get('http://localhost:8000/api/admin/metrics/', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:8000/api/users/auth/sessions/', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setMetrics(metricsResp.data);
      setSessions(sessionsResp.data);
    } catch (err) {
      console.error('Error fetching admin dashboard details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleRevokeSession = async (deviceHash: string) => {
    setRevoking(deviceHash);
    const token = localStorage.getItem('access_token');
    try {
      await axios.post('http://localhost:8000/api/users/auth/sessions/revoke/', {
        device_hash: deviceHash
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Refresh sessions
      fetchAdminData();
    } catch (err) {
      console.error('Failed to revoke session:', err);
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="w-16 h-16 rounded-full border-2 border-brand-500/10 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  const getLogBadgeColor = (type: string) => {
    switch (type) {
      case 'VIRUS_SCAN_FLAGGED': return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'LOGIN_FAILED': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
      case 'VIRUS_SCAN_CLEAN': return 'bg-green-500/10 border-green-500/20 text-green-400';
      default: return 'bg-slate-900 border-slate-800 text-slate-400';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Security & Auditing Dashboard</h1>
        <p className="text-slate-400 mt-1">Review active device sessions, security threat registers, and logs.</p>
      </div>

      {/* Stats row */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-panel p-5 rounded-xl border border-slate-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Users size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{metrics.total_users}</h3>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-slate-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Activity size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Users Today</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{metrics.active_users_today}</h3>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-slate-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Clean Scans</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{metrics.virus_scan_metrics.clean}</h3>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-slate-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <FileWarning size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Flagged Uploads</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{metrics.virus_scan_metrics.flagged}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Multi-device session manager */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <KeyRound size={18} className="text-brand-400" /> Active Session Registry
        </h3>

        <div className="space-y-4">
          {sessions.map((session, i) => (
            <div key={i} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl gap-4">
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">{session.ip}</span>
                  {session.is_current && (
                    <span className="px-2 py-0.5 text-[10px] bg-brand-500/10 border border-brand-500/20 text-brand-400 font-bold rounded">
                      Current Device
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-mono break-all">{session.user_agent}</p>
                <p className="text-[11px] text-slate-400">Last activity: {new Date(session.last_active).toLocaleString()}</p>
              </div>

              {!session.is_current && (
                <button
                  onClick={() => handleRevokeSession(session.device_hash)}
                  disabled={revoking === session.device_hash}
                  className="flex items-center gap-2 text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-2 rounded-lg font-semibold transition-all shrink-0"
                >
                  <Trash2 size={14} /> Revoke Access
                </button>
              )}
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">No active sessions mapped.</p>
          )}
        </div>
      </div>

      {/* Audit Logs Table */}
      {metrics && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <ShieldAlert size={18} className="text-brand-400" /> Security Audit Log
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">Timestamp</th>
                  <th className="pb-3 font-semibold">User</th>
                  <th className="pb-3 font-semibold">Event Type</th>
                  <th className="pb-3 font-semibold">Description</th>
                  <th className="pb-3 font-semibold">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recent_audit_logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-900 hover:bg-slate-900/10 transition-colors">
                    <td className="py-4 text-slate-500 text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-4 text-slate-300 font-medium">{log.email}</td>
                    <td className="py-4">
                      <span className={`px-2 py-0.5 text-[10px] rounded border font-semibold ${getLogBadgeColor(log.event_type)}`}>
                        {log.event_type}
                      </span>
                    </td>
                    <td className="py-4 text-slate-300 max-w-[280px] truncate" title={log.description}>
                      {log.description}
                    </td>
                    <td className="py-4 text-slate-400 font-mono text-xs">{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
