import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckSquare, ArrowUpRight, Sparkles, AlertCircle, XCircle, CheckCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';

interface Resume {
  id: number;
  title: string;
  versions: Array<{
    id: number;
    version_number: number;
    file_name: string;
  }>;
}

interface MatchResult {
  match_percentage: number;
  missing_skills: string[];
  missing_keywords: string[];
  skill_gap_analysis: {
    found_skills: string[];
    missing_skills: string[];
  };
  suggestions: string[];
}

export default function JobMatcher() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  
  // Job Description
  const [jobTitle, setJobTitle] = useState('');
  const [jobText, setJobText] = useState('');
  
  // States
  const [loading, setLoading] = useState(false);
  const [fetchingResumes, setFetchingResumes] = useState(true);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResumes = async () => {
      const token = localStorage.getItem('access_token');
      try {
        const resp = await axios.get('http://localhost:8000/api/resumes/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setResumes(resp.data);
        if (resp.data.length > 0 && resp.data[0].versions.length > 0) {
          setSelectedVersionId(String(resp.data[0].versions[0].id));
        }
      } catch (err) {
        console.error('Error fetching resumes for matcher:', err);
      } finally {
        setFetchingResumes(false);
      }
    };
    fetchResumes();
  }, []);

  const handleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersionId || !jobText) {
      setError('Please select a resume version and paste the job description.');
      return;
    }

    setLoading(true);
    setError('');
    setMatchResult(null);

    const token = localStorage.getItem('access_token');
    try {
      // 1. Submit Job Description
      const jdResp = await axios.post('http://localhost:8000/api/jobs/', {
        title: jobTitle || 'Target Job Posting',
        raw_text: jobText
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const jdId = jdResp.data.id;

      // 2. Trigger Matching Analysis
      const matchResp = await axios.post('http://localhost:8000/api/match/', {
        resume_version_id: Number(selectedVersionId),
        job_description_id: jdId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const matchId = matchResp.data.match_id;

      // 3. Poll for Completion (simulate or wait for Celery completion)
      // Since it runs in Celery asynchronously, we poll the match detail endpoint.
      pollMatchStatus(matchId, token);

    } catch (err: any) {
      setError(err.response?.data?.detail || 'Matching analysis failed.');
      setLoading(false);
    }
  };

  const pollMatchStatus = async (matchId: number, token: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const resp = await axios.get(`http://localhost:8000/api/match/${matchId}/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // If match percentage has been calculated (not 0.0, or check status on celery)
        if (resp.data.match_percentage > 0 || attempts > 10) {
          clearInterval(interval);
          setMatchResult(resp.data);
          setLoading(false);
        }
      } catch (err) {
        clearInterval(interval);
        setError('Error retrieving matching results.');
        setLoading(false);
      }
    }, 1500);
  };

  if (fetchingResumes) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="w-16 h-16 rounded-full border-2 border-brand-500/10 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Semantic Job Alignment</h1>
        <p className="text-slate-400 mt-1">Paste a target job posting to analyze skill gaps and keyword alignments.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left Side: Match Inputs */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 h-fit">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
            <CheckSquare size={16} /> Alignment Parameters
          </h3>

          {error && (
            <div className="mb-6 flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleMatch} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Select Resume Version</label>
              <select 
                value={selectedVersionId} 
                onChange={(e) => setSelectedVersionId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-sm rounded-lg px-3 py-3 text-white outline-none focus:border-brand-500"
              >
                {resumes.map((resume) => 
                  resume.versions.map((ver) => (
                    <option key={ver.id} value={ver.id}>
                      {resume.title} (v{ver.version_number})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Target Job Title</label>
              <input
                type="text"
                placeholder="e.g. Senior Python Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-lg glass-input text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Paste Job Description</label>
              <textarea
                required
                rows={8}
                placeholder="Paste the raw text of the job description or duties list..."
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                className="w-full px-4 py-3 rounded-lg glass-input text-sm text-white font-sans resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Aligning Semantics...
                </>
              ) : (
                <>
                  Calculate Alignment <ArrowUpRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Results */}
        <div className="lg:col-span-3 space-y-6">
          {matchResult ? (
            <>
              {/* Match Score Display */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Match Compatibility</h4>
                  <h2 className="text-5xl font-extrabold text-white mt-2">
                    {matchResult.match_percentage}%
                  </h2>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    matchResult.match_percentage >= 70
                      ? 'bg-green-500/10 border-green-500/20 text-green-400'
                      : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  }`}>
                    {matchResult.match_percentage >= 70 ? 'Optimal Matching' : 'Gaps Detected'}
                  </span>
                </div>
              </div>

              {/* Skill Gap Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Found Skills */}
                <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-green-400 flex items-center gap-2">
                    <CheckCircle size={16} /> Matched Skills ({matchResult.skill_gap_analysis.found_skills.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {matchResult.skill_gap_analysis.found_skills.map((skill, i) => (
                      <span key={i} className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium rounded-lg">
                        {skill}
                      </span>
                    ))}
                    {matchResult.skill_gap_analysis.found_skills.length === 0 && (
                      <span className="text-sm text-slate-500">None detected.</span>
                    )}
                  </div>
                </div>

                {/* Missing Skills */}
                <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-red-400 flex items-center gap-2">
                    <XCircle size={16} /> Gaps / Missing Skills ({matchResult.skill_gap_analysis.missing_skills.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {matchResult.skill_gap_analysis.missing_skills.map((skill, i) => (
                      <span key={i} className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium rounded-lg">
                        {skill}
                      </span>
                    ))}
                    {matchResult.skill_gap_analysis.missing_skills.length === 0 && (
                      <span className="text-sm text-slate-500">None! You match all skills.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Optimization suggestions */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-brand-400 flex items-center gap-2">
                  <Sparkles size={16} /> Suggestions to Optimize Match
                </h3>
                <div className="space-y-3">
                  {matchResult.suggestions.map((sug, i) => (
                    <div key={i} className="text-sm text-slate-300 flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 bg-brand-500 rounded-full mt-2 shrink-0" />
                      <span>{sug}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center py-24 flex flex-col items-center justify-center text-slate-500">
              <Sparkles size={36} className="text-slate-600 mb-3 animate-pulse" />
              <p className="text-sm">Submit your alignment parameters on the left to see the skill gap analysis report.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
