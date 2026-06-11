import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, TrendingUp, Compass, Award, ExternalLink, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import UploadResume from '../components/UploadResume';
import axios from 'axios';

interface Resume {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  latest_version: {
    id: number;
    version_number: number;
    file_name: string;
    file_size: number;
    virus_scanned: boolean;
    virus_scan_clean: boolean;
    created_at: string;
    analysis: {
      status: string;
      ats_score: number;
    } | null;
  } | null;
}

interface DashboardStats {
  total_resumes: number;
  average_ats_score: number;
  score_history: Array<{
    created_at: string;
    ats_score: number;
    resume_version__resume__title: string;
  }>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    try {
      const [resumesResp, statsResp] = await Promise.all([
        axios.get('http://localhost:8000/api/resumes/', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:8000/api/dashboard/', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setResumes(resumesResp.data);
      setStats(statsResp.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'PROCESSING': return 'bg-brand-500/10 text-brand-400 border-brand-500/20 animate-pulse';
      case 'FAILED': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-900 text-slate-400 border-slate-800';
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="relative w-16 h-16 rounded-full border-2 border-brand-500/10 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  // Format data for chart
  const chartData = stats?.score_history.map(item => ({
    name: new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: item.ats_score,
    title: item.resume_version__resume__title
  })) || [];

  return (
    <div className="space-y-8">
      {/* Top Welcome Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Console Analytics</h1>
          <p className="text-slate-400 mt-1">Review your latest resume evaluation scores and job alignments.</p>
        </div>
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-2 text-sm bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-all"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh Stats
        </button>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl flex items-center gap-5 border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl" />
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average ATS Score</p>
            <h3 className="text-3xl font-bold text-white mt-1">{stats?.average_ats_score || 0}<span className="text-sm font-normal text-slate-500">/100</span></h3>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center gap-5 border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Resumes</p>
            <h3 className="text-3xl font-bold text-white mt-1">{stats?.total_resumes || 0}</h3>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center gap-5 border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl" />
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Llama Evaluation Status</p>
            <h3 className="text-lg font-bold text-white mt-1.5 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Active Local
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Score Chart */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Compass size={18} className="text-brand-400" /> ATS Progress Trend
            </h3>
            <span className="text-xs text-slate-500">Score variations across uploads</span>
          </div>

          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4d72ff" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4d72ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#4d72ff" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No evaluation scores available yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Upload box */}
        <div className="lg:col-span-1">
          <UploadResume onUploadSuccess={handleRefresh} />
        </div>
      </div>

      {/* Bottom Section: Upload History */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <Calendar size={18} className="text-brand-400" /> Evaluation History
        </h3>

        {resumes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">Title</th>
                  <th className="pb-3 font-semibold">Version</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">ATS Score</th>
                  <th className="pb-3 font-semibold">Uploaded At</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {resumes.map((resume) => {
                  const latest = resume.latest_version;
                  const analysis = latest?.analysis;
                  
                  return (
                    <tr key={resume.id} className="border-b border-slate-900 hover:bg-slate-900/20 transition-colors">
                      <td className="py-4 font-medium text-slate-200">{resume.title}</td>
                      <td className="py-4 text-slate-400">v{latest?.version_number || 1}</td>
                      <td className="py-4">
                        <span className={`px-2.5 py-1 text-xs rounded-full border font-medium ${getStatusColor(analysis?.status || 'PENDING')}`}>
                          {analysis?.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="py-4 font-bold text-slate-200">
                        {analysis?.status === 'COMPLETED' ? `${analysis.ats_score}/100` : '-'}
                      </td>
                      <td className="py-4 text-slate-500">
                        {new Date(resume.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => navigate(`/resume/${resume.id}`)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
                        >
                          View Details <ExternalLink size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 border border-slate-800/50 rounded-xl bg-slate-900/10">
            <p className="text-sm text-slate-400">No resumes uploaded yet. Click above to start scanning your first resume!</p>
          </div>
        )}
      </div>
    </div>
  );
}
