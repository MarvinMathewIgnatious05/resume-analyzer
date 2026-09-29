import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ShieldCheck, ShieldAlert, Sparkles, FileText, 
  Phone, Mail, ThumbsUp, ThumbsDown, BookOpen, AlertCircle, Trash2, Download
} from 'lucide-react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import { ReportPdfTemplate } from '../components/ReportPdfTemplate';

interface ResumeDetails {
  id: number;
  title: string;
  created_at: string;
  versions: Array<{
    id: number;
    version_number: number;
    file_name: string;
    file_size: number;
    virus_scanned: boolean;
    virus_scan_clean: boolean;
    created_at: string;
    analysis: {
      status: string;
      error_message: string | null;
      extracted_name: string | null;
      extracted_email: string | null;
      extracted_phone: string | null;
      extracted_skills: string[];
      extracted_education: string[];
      extracted_experience: string[];
      extracted_certifications: string[];
      ats_score: number;
      formatting_score: number;
      keyword_coverage_score: number;
      strengths: string[];
      weaknesses: string[];
      improvement_suggestions: string[];
      career_guidance: string;
    } | null;
  }>;
}

export default function ResumeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resume, setResume] = useState<ResumeDetails | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const activeVersion = resume?.versions.find(v => v.id === selectedVersionId);
  const analysis = activeVersion?.analysis;

  const handleDownloadPdfReport = async () => {
    const element = document.getElementById('pdf-report-container');
    if (!element || !resume || !activeVersion || !analysis) return;

    setDownloadingPdf(true);
    try {
      const opt = {
        margin: [0.3, 0.3, 0.3, 0.3] as [number, number, number, number],
        filename: `ATS_Report_${resume.title.replace(/\s+/g, '_')}_v${activeVersion.version_number}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
      };
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDeleteResume = async () => {
    if (!id) return;
    const token = localStorage.getItem('access_token');
    setDeleting(true);
    try {
      await axios.delete(`http://localhost:8000/api/resumes/${id}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/');
    } catch (err) {
      console.error('Error deleting resume:', err);
      alert('Failed to delete evaluation history item.');
      setDeleting(false);
    }
  };

  const fetchResume = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    try {
      const resp = await axios.get(`http://localhost:8000/api/resumes/${id}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResume(resp.data);
      if (resp.data.versions && resp.data.versions.length > 0) {
        setSelectedVersionId(resp.data.versions[0].id);
      }
    } catch (err) {
      console.error('Error fetching resume details:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchResume();
  }, [fetchResume]);

  // Auto-polling for active version analysis / virus scan status
  useEffect(() => {
    if (!resume || !selectedVersionId) return;

    const version = resume.versions.find(v => v.id === selectedVersionId);
    if (!version) return;

    const isPending = !version.virus_scanned || 
                      !version.analysis || 
                      version.analysis.status === 'PENDING' || 
                      version.analysis.status === 'PROCESSING';

    if (!isPending) return;

    const interval = setInterval(() => {
      const token = localStorage.getItem('access_token');
      axios.get(`http://localhost:8000/api/resumes/${id}/`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(resp => {
        setResume(resp.data);
      }).catch(err => {
        console.error('Error polling resume details:', err);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [resume, selectedVersionId, id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="w-16 h-16 rounded-full border-2 border-brand-500/10 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  if (!resume || !activeVersion) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Resume not found.</p>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white">
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Circular Score Component
  const ScoreRing = ({ score, label, colorClass }: { score: number, label: string, colorClass: string }) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="48" cy="48" r={radius} className="stroke-slate-800 fill-none" strokeWidth="6" />
            <circle 
              cx="48" 
              cy="48" 
              r={radius} 
              className={`fill-none transition-all duration-1000 ${colorClass}`}
              strokeWidth="6" 
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-xl font-bold text-white">{score}%</span>
        </div>
        <span className="text-xs font-semibold text-slate-400 mt-2">{label}</span>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{resume.title}</h1>
            <p className="text-sm text-slate-400 mt-0.5">File: {activeVersion.file_name}</p>
          </div>
        </div>

        {/* Version Selector, PDF Download & Delete Action */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 font-medium">Evaluation Version:</span>
          <select 
            value={selectedVersionId || ''} 
            onChange={(e) => setSelectedVersionId(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 text-sm rounded-lg px-3 py-2 text-white outline-none focus:border-brand-500"
          >
            {resume.versions.map((ver) => (
              <option key={ver.id} value={ver.id}>
                v{ver.version_number} ({new Date(ver.created_at).toLocaleDateString()})
              </option>
            ))}
          </select>

          {analysis?.status === 'COMPLETED' && (
            <button
              onClick={handleDownloadPdfReport}
              disabled={downloadingPdf}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-brand-600/20"
              title="Download ATS Assessment PDF Report"
            >
              <Download size={16} className={downloadingPdf ? 'animate-bounce' : ''} /> 
              {downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}
            </button>
          )}

          {showDeleteConfirm ? (
            <div className="flex items-center gap-2 border border-red-500/30 bg-red-500/10 p-1 rounded-lg">
              <button
                onClick={handleDeleteResume}
                disabled={deleting}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-400 rounded-lg text-sm font-semibold transition-all"
              title="Delete Evaluation Record"
            >
              <Trash2 size={16} /> Delete Record
            </button>
          )}
        </div>
      </div>

      {/* Security Status Ribbon */}
      {!activeVersion.virus_scanned ? (
        <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/20 text-blue-400 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin shrink-0" />
            <span className="text-sm font-semibold">Security Integrity: Sandbox scanning in progress...</span>
          </div>
          <span className="text-xs px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full font-medium animate-pulse">Running Scan</span>
        </div>
      ) : activeVersion.virus_scan_clean ? (
        <div className="p-4 rounded-xl border bg-green-500/10 border-green-500/20 text-green-400 flex items-center gap-3">
          <ShieldCheck size={20} className="shrink-0" />
          <span className="text-sm font-semibold">Security Integrity: Sandbox scanner verified file as safe.</span>
        </div>
      ) : (
        <div className="p-4 rounded-xl border bg-red-500/10 border-red-500/20 text-red-400 flex items-center gap-3">
          <ShieldAlert size={20} className="shrink-0" />
          <span className="text-sm font-semibold">Security Alert: File was flagged or failed signature scans.</span>
        </div>
      )}

      {analysis?.status === 'COMPLETED' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left panel: Scores & Details */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Score ring box */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">ATS Evaluation Scorecard</h3>
              <div className="grid grid-cols-3 gap-4 justify-items-center">
                <ScoreRing score={analysis.ats_score} label="Overall ATS" colorClass="stroke-brand-500" />
                <ScoreRing score={analysis.formatting_score} label="Layout Score" colorClass="stroke-purple-500" />
                <ScoreRing score={analysis.keyword_coverage_score} label="Keywords" colorClass="stroke-indigo-400" />
              </div>
            </div>

            {/* Extracted Contact Details Sheet */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Extracted Header</h3>
              <div className="space-y-3.5 text-sm">
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-slate-400">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Full Name</p>
                    <p className="font-semibold">{analysis.extracted_name || 'Not detected'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-slate-400">
                    <Mail size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Email Address</p>
                    <p className="font-semibold">{analysis.extracted_email || 'Not detected'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-slate-400">
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Phone Number</p>
                    <p className="font-semibold">{analysis.extracted_phone || 'Not detected'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Skills parsed tags */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">Extracted Technical Skills</h3>
              <div className="flex flex-wrap gap-2">
                {analysis.extracted_skills.map((skill, i) => (
                  <span key={i} className="px-2.5 py-1 bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold rounded-lg">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel: Strengths, Suggestions, and Career Advice */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Llama 3 Career Guidance Box */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-purple-400" /> Executive AI Summary & Career Guidance
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">{analysis.career_guidance}</p>
            </div>

            {/* Strengths and Weaknesses side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Strengths */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-green-400 flex items-center gap-2">
                  <ThumbsUp size={16} /> Strengths
                </h3>
                <ul className="space-y-2.5 text-sm text-slate-300">
                  {analysis.strengths.map((str, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 shrink-0" />
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-red-400 flex items-center gap-2">
                  <ThumbsDown size={16} /> Key Gaps
                </h3>
                <ul className="space-y-2.5 text-sm text-slate-300">
                  {analysis.weaknesses.map((weak, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 shrink-0" />
                      <span>{weak}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Recommendations & Actionable Steps */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-brand-400 flex items-center gap-2">
                <BookOpen size={16} /> Actionable Resume Optimizations
              </h3>
              <div className="grid grid-cols-1 gap-3 text-sm text-slate-300">
                {analysis.improvement_suggestions.map((imp, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                    <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span>{imp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center flex flex-col items-center justify-center py-20">
          {analysis?.status === 'FAILED' ? (
            <>
              <AlertCircle size={48} className="text-red-500 mb-4 animate-bounce" />
              <h3 className="text-lg font-bold text-white">Analysis Failed</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-md">
                {analysis.error_message || 'An unexpected error occurred during parsing.'}
              </p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full border-2 border-brand-500/10 border-t-brand-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-white">NLP Engine Processing...</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-sm">
                Running structure evaluations, executing keywords mapping, and loading Generative AI feedback.
              </p>
            </>
          )}
        </div>
      )}

      {/* Hidden Container for PDF Export */}
      {activeVersion && analysis && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          <ReportPdfTemplate
            title={resume.title}
            versionNumber={activeVersion.version_number}
            fileName={activeVersion.file_name}
            createdDate={activeVersion.created_at}
            analysis={analysis}
          />
        </div>
      )}
    </div>
  );
}
