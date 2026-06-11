import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from './store/store';
import { logout } from './store/authSlice';
import { LogOut, LayoutDashboard, FileText, CheckSquare, ShieldCheck, User as UserIcon } from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ResumeDetail from './pages/ResumeDetail';
import JobMatcher from './pages/JobMatcher';
import AdminDashboard from './pages/AdminDashboard';

// Custom Route Guard
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const Navigation = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  
  return (
    <nav className="glass-panel border-b border-slate-800 sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">
          Resume Analyzer <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 ml-1">2026 Enterprise</span>
        </Link>
        
        {user && (
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-300">
            <Link to="/" className="flex items-center gap-2 hover:text-brand-400 transition-colors">
              <LayoutDashboard size={16} /> Dashboard
            </Link>
            <Link to="/job-match" className="flex items-center gap-2 hover:text-brand-400 transition-colors">
              <CheckSquare size={16} /> Job Matcher
            </Link>
            <Link to="/admin" className="flex items-center gap-2 hover:text-brand-400 transition-colors">
              <ShieldCheck size={16} /> Security Logs
            </Link>
          </div>
        )}
      </div>

      {user ? (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <UserIcon size={16} className="text-brand-400" />
            <span className="max-w-[150px] truncate">{user.email}</span>
          </div>
          <button
            onClick={() => dispatch(logout())}
            className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-red-500/15 border border-slate-700 hover:border-red-500/30 text-slate-300 hover:text-red-400 px-3 py-1.5 rounded-lg transition-all"
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
      ) : (
        <Link to="/login" className="text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg transition-all">
          Sign In
        </Link>
      )}
    </nav>
  );
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 flex flex-col selection:bg-brand-500/30 selection:text-white">
        {/* Background Decorative Orbs */}
        <div className="glow-orb-primary top-10 left-10" />
        <div className="glow-orb-secondary bottom-10 right-10" />

        <Navigation />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/verify" element={<Login isVerifyMode />} />
            
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/resume/:id" element={<PrivateRoute><ResumeDetail /></PrivateRoute>} />
            <Route path="/job-match" element={<PrivateRoute><JobMatcher /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
