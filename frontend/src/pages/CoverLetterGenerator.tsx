import { useState, useEffect } from 'react';
import { 
  Sparkles, Copy, Check, Download, Trash2, FileText, 
  Briefcase, Building2, RefreshCw, AlertCircle, Award, Feather
} from 'lucide-react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';

interface Resume {
  id: number;
  title: string;
  versions: Array<{
    id: number;
    version_number: number;
    file_name: string;
  }>;
}

interface CoverLetterRecord {
  id: number;
  resume_version: number | null;
  job_title: string;
  company: string;
  job_description: string;
  tone: string;
  content: string;
  key_highlights: string[];
  created_at: string;
}

const TONE_OPTIONS = [
  { id: 'Professional', label: 'Professional & Formal', desc: 'Standard business tone suitable for corporate environments' },
  { id: 'Enthusiastic', label: 'Enthusiastic & High Energy', desc: 'Passionate and driven tone for startups and tech roles' },
  { id: 'Executive', label: 'Executive & Leadership', desc: 'Strategic, high-level impact tone for management roles' },
  { id: 'Concise', label: 'Concise & Direct', desc: 'Short, punchy bulleted tone for busy recruiters' }
];

export default function CoverLetterGenerator() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [history, setHistory] = useState<CoverLetterRecord[]>([]);
  
  // Inputs
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedTone, setSelectedTone] = useState('Professional');

  // Execution states
  const [loading, setLoading] = useState(false);
  const [fetchingResumes, setFetchingResumes] = useState(true);
  const [error, setError] = useState('');
  const [currentCoverLetter, setCurrentCoverLetter] = useState<CoverLetterRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('access_token');
      try {
        const [resumesResp, historyResp] = await Promise.all([
          axios.get('http://localhost:8000/api/resumes/', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get('http://localhost:8000/api/cover-letters/', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        setResumes(resumesResp.data);
        if (resumesResp.data.length > 0 && resumesResp.data[0].versions.length > 0) {
          setSelectedVersionId(String(resumesResp.data[0].versions[0].id));
        }

        setHistory(historyResp.data);
        if (historyResp.data.length > 0) {
          setCurrentCoverLetter(historyResp.data[0]);
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
      } finally {
        setFetchingResumes(false);
      }
    };

    fetchData();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersionId) {
      setError('Please select a resume version.');
      return;
    }

    setLoading(true);
    setError('');

    const token = localStorage.getItem('access_token');
    try {
      const resp = await axios.post('http://localhost:8000/api/cover-letters/generate/', {
        resume_version_id: Number(selectedVersionId),
        job_title: jobTitle || 'Software Engineer',
        company: company || 'Target Company',
        job_description: jobDescription,
        tone: selectedTone
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCurrentCoverLetter(resp.data);
      setHistory(prev => [resp.data, ...prev]);
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.response?.data?.detail || 'Failed to generate cover letter. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!currentCoverLetter) return;
    navigator.clipboard.writeText(currentCoverLetter.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!currentCoverLetter) return;
    const element = document.createElement('a');
    const file = new Blob([currentCoverLetter.content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `Cover_Letter_${currentCoverLetter.company.replace(/\s+/g, '_')}_${currentCoverLetter.job_title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('cover-letter-pdf-container');
    if (!element || !currentCoverLetter) return;

    setDownloadingPdf(true);
    try {
      const opt = {
        margin: [0.4, 0.4, 0.4, 0.4] as [number, number, number, number],
        filename: `Cover_Letter_${currentCoverLetter.company.replace(/\s+/g, '_')}_${currentCoverLetter.job_title.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
      };
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Failed to generate PDF cover letter.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDeleteHistory = async (id: number) => {
    const token = localStorage.getItem('access_token');
    setDeletingId(id);
    try {
      await axios.delete(`http://localhost:8000/api/cover-letters/${id}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(prev => prev.filter(item => item.id !== id));
      if (currentCoverLetter?.id === id) {
        const remaining = history.filter(item => item.id !== id);
        setCurrentCoverLetter(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete cover letter entry.');
    } finally {
      setDeletingId(null);
    }
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
      {/* Top Welcome Panel */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
          <Sparkles className="text-purple-400" /> AI Cover Letter Generator
        </h1>
        <p className="text-slate-400 mt-1">Generate highly tailored, professional cover letters using Llama 3 intelligence based on your resume and target job requirements.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left Form Panel */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Feather size={16} className="text-brand-400" /> Generation Parameters
          </h3>

          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleGenerate} className="space-y-5">
            {/* Resume Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Select Candidate Resume Version</label>
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

            {/* Job Title & Company Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Briefcase size={14} /> Job Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Python Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg glass-input text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Building2 size={14} /> Company
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg glass-input text-sm text-white"
                />
              </div>
            </div>

            {/* Tone Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Select Preferred Tone</label>
              <div className="grid grid-cols-2 gap-2">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTone(t.id)}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      selectedTone === t.id
                        ? 'bg-brand-500/10 border-brand-500/50 text-white font-semibold shadow-md shadow-brand-500/10'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="font-semibold text-slate-200">{t.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Job Description Textarea */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Paste Job Description (Optional)</label>
              <textarea
                rows={6}
                placeholder="Paste key responsibilities or requirements from the target job posting..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-lg glass-input text-sm text-white font-sans resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Drafting Cover Letter...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Generate AI Cover Letter
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Output Panel & History */}
        <div className="lg:col-span-3 space-y-6">
          {currentCoverLetter ? (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6 relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{currentCoverLetter.job_title}</h3>
                  <p className="text-sm text-slate-400">{currentCoverLetter.company} • <span className="text-brand-400 font-medium">{currentCoverLetter.tone} Tone</span></p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-all"
                  >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>

                  <button
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                    className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all shadow-md shadow-brand-600/20"
                    title="Download Letter as PDF"
                  >
                    <Download size={14} className={downloadingPdf ? 'animate-bounce' : ''} /> 
                    {downloadingPdf ? 'Exporting PDF...' : 'Download PDF'}
                  </button>

                  <button
                    onClick={handleDownloadTxt}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg transition-all"
                  >
                    <Download size={14} /> .txt
                  </button>
                </div>
              </div>

              {/* Key Highlights */}
              {currentCoverLetter.key_highlights && currentCoverLetter.key_highlights.length > 0 && (
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Award size={14} /> Key Targeted Match Highlights
                  </p>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {currentCoverLetter.key_highlights.map((h, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Formatted Cover Letter Output */}
              <div className="p-6 bg-slate-950/80 border border-slate-800/80 rounded-xl font-sans text-sm text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-brand-500/30">
                {currentCoverLetter.content}
              </div>
            </div>
          ) : (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center py-24 flex flex-col items-center justify-center text-slate-500">
              <FileText size={40} className="text-slate-600 mb-3 animate-pulse" />
              <p className="text-sm">Configure your parameters on the left to generate your custom AI cover letter.</p>
            </div>
          )}

          {/* Generated Cover Letters History */}
          {history.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Generated History ({history.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div 
                    key={item.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      currentCoverLetter?.id === item.id
                        ? 'bg-brand-500/10 border-brand-500/30 text-white'
                        : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:border-slate-700'
                    }`}
                    onClick={() => setCurrentCoverLetter(item)}
                  >
                    <div>
                      <p className="font-semibold text-xs text-slate-200">{item.job_title} at {item.company}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.tone} • {new Date(item.created_at).toLocaleDateString()}</p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteHistory(item.id);
                      }}
                      disabled={deletingId === item.id}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-slate-500 transition-colors"
                      title="Delete Entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Offscreen Container for Formal Letterhead PDF Export */}
      {currentCoverLetter && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          <div 
            id="cover-letter-pdf-container"
            className="p-10 bg-white text-slate-900 font-sans max-w-[800px] mx-auto border border-slate-200"
            style={{ width: '800px', boxSizing: 'border-box' }}
          >
            {/* Letterhead Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">{currentCoverLetter.job_title} Application</h1>
                <p className="text-xs font-semibold text-slate-600 mt-1">Target Company: {currentCoverLetter.company}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>Date: {new Date(currentCoverLetter.created_at).toLocaleDateString()}</p>
                <p className="capitalize">Style: {currentCoverLetter.tone}</p>
              </div>
            </div>

            {/* Letter Content */}
            <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans my-6">
              {currentCoverLetter.content}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 pt-4 mt-8 text-center text-[10px] text-slate-400">
              Formatted & Generated via AI Resume Analyzer Enterprise Platform
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
