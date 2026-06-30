import React, { useState } from 'react';
import { CivicIssue } from '../types';
import { Sparkles, BrainCircuit, Activity, BarChart3, AlertCircle, Clock } from 'lucide-react';

interface InsightsPanelProps {
  issues: CivicIssue[];
  user: { username: string; role: 'citizen' | 'officer' } | null;
  token: string | null;
  onRequireAuth: () => void;
}

export default function InsightsPanel({ issues, user, token, onRequireAuth }: InsightsPanelProps) {
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate live statistics
  const totalIssues = issues.length;
  const resolvedIssues = issues.filter(i => i.status === 'resolved').length;
  const verifiedIssues = issues.filter(i => i.status === 'verified').length;
  const escalatedIssues = issues.filter(i => i.status === 'escalated').length;

  const resolutionRate = totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 0;
  
  // Calculate average severity
  const avgSeverity = totalIssues > 0 
    ? (issues.reduce((sum, i) => sum + i.severityScore, 0) / totalIssues).toFixed(1) 
    : '0.0';

  // Category counts
  const categoryCounts = issues.reduce((acc, issue) => {
    acc[issue.category] = (acc[issue.category] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const fetchAIInsights = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/insights', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.insights) {
        setInsights(data.insights);
      } else {
        setInsights(data.error || 'Failed to generate insights. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
      setInsights('Failed to connect to the Gemini intelligence server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Simple custom renderer to make the raw Gemini markdown look gorgeous with typography
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      
      // Headers
      if (trimmed.startsWith('###')) {
        return <h4 key={idx} className="text-sm font-bold text-slate-100 mt-4 mb-2 font-mono uppercase tracking-wide">{trimmed.replace('###', '')}</h4>;
      }
      if (trimmed.startsWith('##')) {
        return <h3 key={idx} className="text-base font-extrabold text-amber-400 mt-5 mb-2">{trimmed.replace('##', '')}</h3>;
      }
      if (trimmed.startsWith('#')) {
        return <h2 key={idx} className="text-lg font-black text-amber-500 mt-6 mb-3">{trimmed.replace('#', '')}</h2>;
      }

      // Bullet points
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        const cleaned = trimmed.replace(/^[\s*-]+/, '');
        // Highlight critical terms inside bullets
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-slate-300 leading-relaxed mb-1.5">
            {parseInlineStyling(cleaned)}
          </li>
        );
      }

      // Paragraphs
      if (trimmed.length > 0) {
        return <p key={idx} className="text-xs text-slate-300 leading-relaxed mb-3">{parseInlineStyling(trimmed)}</p>;
      }

      return <div key={idx} className="h-2" />;
    });
  };

  const parseInlineStyling = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-amber-400 font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div id="insights-panel-container" className="space-y-6">
      {/* Bento Grid Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
          <div className="flex justify-between items-center text-slate-500 mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">TOTAL ISSUES</span>
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-white font-mono">{totalIssues}</p>
            <p className="text-[10px] text-slate-400 mt-1">Reported by community</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
          <div className="flex justify-between items-center text-slate-500 mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">RESOLVED RATE</span>
            <BarChart3 className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-white font-mono">{resolutionRate}%</p>
            <p className="text-[10px] text-slate-400 mt-1">{resolvedIssues} resolved of {totalIssues}</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
          <div className="flex justify-between items-center text-slate-500 mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">AVG SEVERITY</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-white font-mono">{avgSeverity}/5</p>
            <p className="text-[10px] text-slate-400 mt-1">Hazard scale baseline</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
          <div className="flex justify-between items-center text-slate-500 mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">DISPATCH FLOW</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-white font-mono">
              {escalatedIssues} <span className="text-xs text-slate-500 font-normal">sent</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">{verifiedIssues} verifications pending</p>
          </div>
        </div>
      </div>

      {/* Gemini AI Neighborhood Intelligence Module */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/35 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <BrainCircuit className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Gemini AI Neighborhood Intelligence
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 rounded border border-indigo-400/20">
                  v3.5-Flash
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Analyze and compile actionable patterns from active community reports
              </p>
            </div>
          </div>

          {user && user.role === 'officer' && (
            <button
              id="compile-insights-btn"
              onClick={fetchAIInsights}
              disabled={isLoading || totalIssues === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-indigo-500/25 transition duration-200 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              {isLoading ? 'Compiling Datasets...' : 'Compile Hotspot Summary'}
            </button>
          )}
        </div>

        {/* Intelligence Report Display */}
        {!user ? (
          <div className="text-center py-8 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl">
            <p className="text-xs text-slate-450">Sign in as a Municipal Officer to compile AI spatial summaries.</p>
            <button
              onClick={onRequireAuth}
              className="mt-3 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 font-bold text-xs rounded-xl transition"
            >
              Sign In
            </button>
          </div>
        ) : user.role !== 'officer' ? (
          <div className="text-center py-8 bg-slate-950/20 border border-dashed border-slate-850 rounded-xl px-4">
            <AlertCircle className="w-8 h-8 text-amber-500/85 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-slate-350 uppercase tracking-widest font-mono">Access Restricted</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1.5 leading-relaxed">
              AI spatial analytics and hotspot compilation is restricted to Municipal Officers. You are signed in as a citizen.
            </p>
          </div>
        ) : isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <p className="text-xs font-mono text-slate-400">
              Aggregating geographical coordinate matrices... Analyzing community reports...
            </p>
          </div>
        ) : insights ? (
          <div className="prose prose-invert max-w-none bg-slate-950/40 rounded-xl p-5 border border-slate-800">
            <div className="flex items-center gap-2 mb-3.5 text-xs text-indigo-300 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>LATEST AI COMPILED INTEL - {new Date().toLocaleDateString()}</span>
            </div>
            <div className="space-y-1">{renderMarkdown(insights)}</div>
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl">
            <p className="text-xs text-slate-500">
              {totalIssues === 0 
                ? 'No active hazard logs registered. Report issues to generate AI summary insights.' 
                : 'Click "Compile Hotspot Summary" to launch AI-grounded neighborhood spatial intelligence analysis.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
