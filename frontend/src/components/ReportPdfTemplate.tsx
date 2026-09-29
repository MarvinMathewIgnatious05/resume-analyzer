import React from 'react';

interface AnalysisData {
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
}

interface ReportPdfTemplateProps {
  title: string;
  versionNumber: number;
  fileName: string;
  createdDate: string;
  analysis: AnalysisData;
}

export const ReportPdfTemplate: React.FC<ReportPdfTemplateProps> = ({
  title,
  versionNumber,
  fileName,
  createdDate,
  analysis
}) => {
  return (
    <div 
      id="pdf-report-container"
      className="p-8 bg-white text-slate-900 font-sans max-w-[800px] mx-auto border border-slate-200 shadow-sm"
      style={{ width: '800px', boxSizing: 'border-box' }}
    >
      {/* Header Banner */}
      <div className="border-b-2 border-indigo-600 pb-5 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-xs text-slate-500 mt-1">
            File: <span className="font-semibold text-slate-700">{fileName}</span> (v{versionNumber}) • Evaluated on {new Date(createdDate).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-xs rounded-md uppercase tracking-wider">
            Resume Analyzer Enterprise Report
          </span>
        </div>
      </div>

      {/* Candidate Header Details */}
      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-3 gap-4 text-xs">
        <div>
          <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Candidate Name</p>
          <p className="font-bold text-slate-800 text-sm mt-0.5">{analysis.extracted_name || 'Not detected'}</p>
        </div>
        <div>
          <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Email Address</p>
          <p className="font-bold text-slate-800 text-sm mt-0.5">{analysis.extracted_email || 'Not detected'}</p>
        </div>
        <div>
          <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Phone Number</p>
          <p className="font-bold text-slate-800 text-sm mt-0.5">{analysis.extracted_phone || 'Not detected'}</p>
        </div>
      </div>

      {/* Scorecards */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">ATS Score Breakdown</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-lg text-center">
            <p className="text-[11px] font-semibold text-indigo-700 uppercase">Overall ATS Score</p>
            <p className="text-3xl font-extrabold text-indigo-600 mt-1">{analysis.ats_score}<span className="text-sm font-normal text-slate-500">/100</span></p>
          </div>

          <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-lg text-center">
            <p className="text-[11px] font-semibold text-purple-700 uppercase">Layout & Formatting</p>
            <p className="text-3xl font-extrabold text-purple-600 mt-1">{analysis.formatting_score}<span className="text-sm font-normal text-slate-500">/100</span></p>
          </div>

          <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-lg text-center">
            <p className="text-[11px] font-semibold text-blue-700 uppercase">Keyword Coverage</p>
            <p className="text-3xl font-extrabold text-blue-600 mt-1">{analysis.keyword_coverage_score}<span className="text-sm font-normal text-slate-500">/100</span></p>
          </div>
        </div>
      </div>

      {/* Parsed Technical Skills */}
      {analysis.extracted_skills && analysis.extracted_skills.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Parsed Technical Skills</h2>
          <div className="flex flex-wrap gap-1.5">
            {analysis.extracted_skills.map((skill, idx) => (
              <span key={idx} className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold rounded">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Executive AI Summary */}
      {analysis.career_guidance && (
        <div className="mb-6 p-4 bg-indigo-50/40 border border-indigo-200/60 rounded-lg">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-800 mb-1.5">Executive AI Summary & Guidance</h2>
          <p className="text-xs text-slate-700 leading-relaxed">{analysis.career_guidance}</p>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Strengths */}
        <div className="p-4 bg-emerald-50/40 border border-emerald-200/60 rounded-lg">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">Key Strengths</h3>
          <ul className="space-y-1.5 text-xs text-slate-700">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="p-4 bg-rose-50/40 border border-rose-200/60 rounded-lg">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-2">Gaps & Risk Areas</h3>
          <ul className="space-y-1.5 text-xs text-slate-700">
            {analysis.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-rose-600 font-bold">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Actionable Optimizations */}
      {analysis.improvement_suggestions && analysis.improvement_suggestions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Actionable Optimizations</h2>
          <div className="space-y-2">
            {analysis.improvement_suggestions.map((rec, idx) => (
              <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 flex items-start gap-2">
                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 font-bold text-[10px] rounded shrink-0">
                  {idx + 1}
                </span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-400">
        Generated by AI Resume Analyzer Enterprise Platform • Confidential & Candidate-Owned
      </div>
    </div>
  );
};
