import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

interface UploadResumeProps {
  onUploadSuccess: () => void;
}

export default function UploadResume({ onUploadSuccess }: UploadResumeProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (selectedFile: File): boolean => {
    setError('');
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    
    // Check file format
    if (extension !== 'pdf' && extension !== 'docx') {
      setError('Invalid file format. Only PDF and DOCX files are allowed.');
      return false;
    }
    
    // Check size limit (5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum size is 5MB.');
      return false;
    }

    return true;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      if (validateFile(selected)) {
        setFile(selected);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (validateFile(selected)) {
        setFile(selected);
      }
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setLoading(true);
    setError('');
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ""));

    const token = localStorage.getItem('access_token');

    try {
      await axios.post('http://localhost:8000/api/resumes/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          const percent = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setProgress(percent);
        }
      });

      setSuccess(true);
      setFile(null);
      setTimeout(() => {
        setSuccess(false);
        onUploadSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'An error occurred during upload. Please check file formatting or virus scanning flags.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-800">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Upload size={18} className="text-brand-400" /> Upload Resume
      </h3>

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-all ${
          dragActive 
            ? 'border-brand-500 bg-brand-500/5' 
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/10'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.docx"
        />

        <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-400">
          <FileText size={20} />
        </div>

        {file ? (
          <div className="space-y-4 w-full max-w-xs">
            <p className="text-sm font-semibold text-slate-200 truncate">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setFile(null)}
                className="px-3 py-1.5 border border-slate-800 hover:bg-slate-900 text-xs rounded-lg text-slate-400 font-medium transition-all"
              >
                Clear
              </button>
              <button
                onClick={handleUpload}
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-xs text-white rounded-lg font-medium transition-all shadow-md shadow-brand-500/15"
              >
                Analyze
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-300">
              Drag & drop your resume here or{' '}
              <button onClick={onButtonClick} className="text-brand-400 font-semibold hover:underline">
                browse files
              </button>
            </p>
            <p className="text-xs text-slate-500 mt-2">Supports PDF and DOCX formats (Max 5MB)</p>
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Parsing structure & executing virus scanner...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-brand-500 h-full transition-all duration-300" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-6 flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <span>Resume uploaded and queued for NLP analysis!</span>
        </div>
      )}
    </div>
  );
}
