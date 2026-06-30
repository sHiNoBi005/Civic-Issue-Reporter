import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Sparkles,
  Map,
  List,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Mail,
  RefreshCw,
  Clock,
  Landmark,
  Layers,
  HelpCircle,
  PlusCircle,
  MapPin,
  Heart,
  CheckCircle,
  X,
  User as UserIcon,
  Lock,
  Eye,
  AlertCircle
} from 'lucide-react';
import { CivicIssue } from './types';
import MapView from './components/MapView';
import IssueForm from './components/IssueForm';
import IssueList from './components/IssueList';
import IssueDetailModal from './components/IssueDetailModal';
import InsightsPanel from './components/InsightsPanel';

export default function App() {
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [pinningCoords, setPinningCoords] = useState<{ lat: number; lng: number }>({
    lat: 12.9716,
    lng: 77.5946,
  });
  
  const [activeTab, setActiveTab] = useState<'map' | 'browse' | 'report' | 'insights'>('map');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [time, setTime] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem('civic_pulse_token'));
  const [user, setUser] = useState<{ username: string; role: 'citizen' | 'officer' } | null>(null);
  
  // Login / Register Modal State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginTab, setLoginTab] = useState<'signin' | 'register'>('signin');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Live clock updates
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch current user details if token exists
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Session expired');
        })
        .then((data) => {
          setUser(data);
        })
        .catch(() => {
          localStorage.removeItem('civic_pulse_token');
          setToken(null);
          setUser(null);
        });
    } else {
      setUser(null);
    }
  }, [token]);

  // Fetch all issues on mount
  const fetchIssues = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/issues');
      const data = await response.json();
      if (Array.isArray(data)) {
        setIssues(data);
      }
    } catch (error) {
      console.error('Error loading issues:', error);
      showToast('Could not load reported issues from server.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Submit a newly reported issue (Authenticated)
  const handleReportSubmit = async (formData: { photoUrl: string; description: string; lat: number; lng: number }) => {
    if (!token) {
      showToast('Please sign in to report issues.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      
      if (response.ok) {
        showToast('Civic report analyzed and registered successfully!', 'success');
        setIssues((prev) => [result, ...prev]);
        setSelectedIssueId(result.id);
        setActiveTab('map');
      } else {
        showToast(result.error || 'Failed to submit report', 'error');
      }
    } catch (error) {
      console.error('Error submitting civic report:', error);
      showToast('Connection error. Failed to analyze photo.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upvote / Verify an issue (Authenticated)
  const handleUpvote = async (id: string, updatedPayload?: CivicIssue) => {
    if (updatedPayload) {
      setIssues((prev) => prev.map((item) => (item.id === id ? updatedPayload : item)));
      showToast('Your verification vote has been registered!', 'success');
      return;
    }
    if (!token) {
      showToast('Please sign in to verify reports.', 'info');
      setLoginTab('signin');
      setAuthError(null);
      setShowLoginModal(true);
      return;
    }
    try {
      const response = await fetch(`/api/issues/${id}/upvote`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const updated = await response.json();
      if (response.ok) {
        setIssues((prev) => prev.map((item) => (item.id === id ? updated : item)));
        showToast('Your verification vote has been registered!', 'success');
      } else {
        showToast(updated.error || 'Failed to verify issue.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to verify issue.', 'error');
    }
  };

  // Escalate an issue (Authenticated - Officer only)
  const handleEscalate = async (id: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/issues/${id}/escalate`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const updated = await response.json();
      if (response.ok) {
        setIssues((prev) => prev.map((item) => (item.id === id ? updated : item)));
        showToast('Escalation message dispatched successfully!', 'success');
      } else {
        showToast(updated.error || 'Failed to dispatch escalation.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to dispatch escalation.', 'error');
    }
  };

  // Resolve an issue (Authenticated - Officer only)
  const handleResolve = async (id: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/issues/${id}/resolve`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const updated = await response.json();
      if (response.ok) {
        setIssues((prev) => prev.map((item) => (item.id === id ? updated : item)));
        showToast('Hazard marked as resolved! Great work!', 'success');
      } else {
        showToast(updated.error || 'Failed to mark as resolved.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to mark as resolved.', 'error');
    }
  };

  // Sign In / Register submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);
    const endpoint = loginTab === 'signin' ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('civic_pulse_token', data.token);
        setToken(data.token);
        setUser(data.user);
        setShowLoginModal(false);
        setUsernameInput('');
        setPasswordInput('');
        showToast(loginTab === 'signin' ? 'Welcome back!' : 'Account registered and signed in!', 'success');
      } else {
        setAuthError(data.error || 'Authentication failed.');
      }
    } catch (err) {
      setAuthError('Connection error. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('civic_pulse_token');
    setToken(null);
    setUser(null);
    showToast('Signed out successfully.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Toast notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 transform -translate-x-1/2 z-[10001] px-5 py-3 rounded-xl border shadow-2xl flex items-center gap-3 backdrop-blur-md bg-slate-900 border-slate-700 max-w-md"
          >
            <div className={`w-2.5 h-2.5 rounded-full ${
              notification.type === 'success' ? 'bg-emerald-500' : notification.type === 'error' ? 'bg-rose-500' : 'bg-amber-500'
            }`} />
            <span className="text-xs font-semibold text-slate-200">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Top Navigation Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 rounded-xl font-black shadow-lg shadow-orange-500/15">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-white uppercase font-sans">
                Civic Pulse <span className="text-[10px] text-amber-400 font-bold ml-1">AI</span>
              </h1>
              <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">Hyperlocal Reporter</p>
            </div>
          </div>

          {/* Time & Live Metadata */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 shadow-sm">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>{time || 'SYNCHRONIZING...'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-500 text-[10px] uppercase">Node Live</span>
            </div>
          </div>

          {/* View Toggles, Report Button & Auth Profile */}
          <div className="flex items-center gap-4">
            <nav className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
              <button
                id="tab-map-btn"
                onClick={() => setActiveTab('map')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === 'map'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Map View</span>
              </button>
              <button
                id="tab-browse-btn"
                onClick={() => setActiveTab('browse')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === 'browse'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Browse Issues</span>
              </button>
              <button
                id="tab-report-btn"
                onClick={() => setActiveTab('report')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === 'report'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Report Issue</span>
              </button>
              <button
                id="tab-insights-btn"
                onClick={() => setActiveTab('insights')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === 'insights'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AI Insights</span>
              </button>
            </nav>

            {/* Auth Profile / Login Button */}
            <div className="flex items-center gap-2">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-white">@{user.username}</p>
                    <p className="text-[9px] text-amber-400 font-mono tracking-wider uppercase font-bold">{user.role}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 hover:bg-slate-850 hover:text-white rounded-xl transition"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAuthError(null);
                    setLoginTab('signin');
                    setShowLoginModal(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:opacity-90 font-bold text-xs rounded-xl shadow-lg transition"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Workspace */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 md:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {activeTab === 'map' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-850 p-5 rounded-2xl shadow-lg">
                  <div>
                    <h2 className="text-base font-extrabold text-white uppercase tracking-tight flex items-center gap-2">
                      <Map className="w-5 h-5 text-amber-500" />
                      Live Dispatch Map
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Plotting active municipal hazard reports color-coded by real-time severity scores. Click the map to drop a pin.
                    </p>
                  </div>
                  <button
                    id="map-report-redirect"
                    onClick={() => setActiveTab('report')}
                    className="self-start md:self-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:opacity-90 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Report New Incident
                  </button>
                </div>

                <MapView
                  issues={issues}
                  selectedIssueId={selectedIssueId}
                  onSelectIssue={(id) => setSelectedIssueId(id)}
                  pinningCoords={pinningCoords}
                  onSetPinningCoords={(coords) => {
                    setPinningCoords(coords);
                    setActiveTab('report');
                    showToast('Coordinates selected! Please provide incident details below.', 'info');
                  }}
                  isReportingMode={false}
                />
              </div>
            )}

            {activeTab === 'browse' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-850 p-5 rounded-2xl shadow-lg">
                  <div>
                    <h2 className="text-base font-extrabold text-white uppercase tracking-tight flex items-center gap-2">
                      <List className="w-5 h-5 text-amber-500" />
                      Browse Neighborhood Hazards
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Search, sort, and filter verified and reported hazards across the district.
                    </p>
                  </div>
                  <button
                    id="list-refresh-btn"
                    onClick={fetchIssues}
                    className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 transition"
                    disabled={isLoading}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh Database
                  </button>
                </div>

                <IssueList
                  issues={issues}
                  isLoading={isLoading}
                  onRefresh={fetchIssues}
                  selectedIssueId={selectedIssueId}
                  onSelectIssue={(id) => setSelectedIssueId(id)}
                  onUpvoteIssue={handleUpvote}
                />
              </div>
            )}

            {activeTab === 'report' && (
              !user ? (
                <div className="max-w-md mx-auto text-center py-16 px-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col items-center gap-4 mt-8">
                  <div className="p-3 bg-amber-500/10 text-amber-500 rounded-full">
                    <PlusCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Sign In Required</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    You must be logged in to submit new civic hazard reports. Sign in or create a community account to start contributing to your neighborhood.
                  </p>
                  <button
                    onClick={() => {
                      setAuthError(null);
                      setLoginTab('signin');
                      setShowLoginModal(true);
                    }}
                    className="mt-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition"
                  >
                    Sign In / Register
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-8 space-y-6">
                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl shadow-lg">
                      <h2 className="text-base font-extrabold text-white uppercase tracking-tight flex items-center gap-2">
                        <PlusCircle className="w-5 h-5 text-amber-500" />
                        File a New Civic Pulse Report
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Upload a photo of a community hazard. Our multimodal AI model will categorize, evaluate, and geotag it automatically for swift municipal action.
                      </p>
                      <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-amber-400">Current Geotag Location</p>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                            Lat: {pinningCoords.lat.toFixed(6)}, Lng: {pinningCoords.lng.toFixed(6)}
                          </p>
                          <button
                            onClick={() => setActiveTab('map')}
                            className="text-[10px] text-amber-400 underline font-semibold mt-1 hover:text-amber-300 block"
                          >
                            Change coordinates on map &rarr;
                          </button>
                        </div>
                      </div>
                    </div>

                    <IssueForm
                      onSubmit={handleReportSubmit}
                      pinningCoords={pinningCoords}
                      onSetPinningCoords={(coords) => setPinningCoords(coords)}
                      isSubmitting={isSubmitting}
                    />
                  </div>

                  <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-amber-500" />
                        Dispatch Core Instructions
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed mt-2.5">
                        Simply select an image preset or drag-and-drop any JPG/PNG image to simulate a real-time smart reporter device submission.
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed mt-2">
                        Gemini analyzes visual hazards (potholes, water leaks, illegal trash dumping) instantly to allocate emergency response vectors.
                      </p>
                      <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                        <Heart className="w-3 h-3 text-red-500 animate-pulse fill-red-500" />
                        <span>Compiled for Hackathon</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            {activeTab === 'insights' && (
              <InsightsPanel issues={issues} user={user} token={token} onRequireAuth={() => {
                setAuthError(null);
                setLoginTab('signin');
                setShowLoginModal(true);
              }} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Civic Pulse AI. Hyperlocal Emergency Node.</p>
          <div className="flex items-center gap-4 text-[10px] font-mono">
            <span>POWERED BY GEMINI-3.5-FLASH</span>
            <span>|</span>
            <span>SECURE SERVER DISPATCH GATEWAY</span>
          </div>
        </div>
      </footer>

      {/* DETAIL MODAL OVERLAY */}
      {selectedIssueId && (
        <IssueDetailModal
          issue={issues.find((i) => i.id === selectedIssueId) || null}
          onClose={() => setSelectedIssueId(null)}
          onUpvote={handleUpvote}
          onEscalate={handleEscalate}
          onResolve={handleResolve}
          user={user}
        />
      )}

      {/* AUTH LOGIN/REGISTER MODAL DIALOG */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
            {/* Close Button */}
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-800 mb-5">
              <button
                onClick={() => { setLoginTab('signin'); setAuthError(null); }}
                className={`flex-1 pb-2.5 text-xs font-bold font-mono uppercase tracking-wider transition ${
                  loginTab === 'signin' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setLoginTab('register'); setAuthError(null); }}
                className={`flex-1 pb-2.5 text-xs font-bold font-mono uppercase tracking-wider transition ${
                  loginTab === 'register' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                Register
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input
                    type="text"
                    required
                    placeholder="Enter username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none pl-10 pr-4 py-2.5 text-slate-200 placeholder-slate-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input
                    type="password"
                    required
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none pl-10 pr-4 py-2.5 text-slate-200 placeholder-slate-600 transition"
                  />
                </div>
              </div>

              {/* Error messages */}
              {authError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg transition flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <UserIcon className="w-4 h-4" />
                {isAuthenticating 
                  ? 'Authenticating...' 
                  : loginTab === 'signin' 
                  ? 'Sign In to Account' 
                  : 'Register Account'
                }
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-850/60 text-center">
              <p className="text-[10px] text-slate-500 font-mono">
                {loginTab === 'signin' 
                  ? 'Demo users: citizen / password123 or officer / password123'
                  : 'New registrations default to citizen role permissions.'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
