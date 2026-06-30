import React, { useState } from 'react';
import { CivicIssue } from '../types';
import { X, Check, Copy, AlertTriangle, ShieldCheck, Mail, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface IssueDetailModalProps {
  issue: CivicIssue | null;
  onClose: () => void;
  onUpvote: (id: string) => void;
  onEscalate: (id: string) => void;
  onResolve: (id: string) => void;
  user: { username: string; role: 'citizen' | 'officer' } | null;
}

export default function IssueDetailModal({
  issue,
  onClose,
  onUpvote,
  onEscalate,
  onResolve,
  user,
}: IssueDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!issue) return null;

  const handleCopyDraft = () => {
    const textToCopy = `To: ${issue.escalationDraft.recipient}\nSubject: ${issue.escalationDraft.subject}\n\n${issue.escalationDraft.body}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSeverityBadgeColor = (score: number) => {
    if (score >= 5) return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    if (score >= 4) return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    if (score >= 3) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'escalated':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 'verified':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      default:
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        id="issue-detail-card"
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/55">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-xs font-bold font-mono uppercase tracking-widest rounded-lg border ${getStatusBadgeColor(issue.status)}`}>
              {issue.status}
            </span>
            <span className="text-xs text-slate-500 font-mono">ID: {issue.id}</span>
          </div>
          <button
            id="close-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Main layout grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Visual Data */}
            <div className="space-y-4">
              <div className="aspect-video md:aspect-square w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative group shadow-inner">
                <img
                  src={issue.photoUrl}
                  alt={issue.category}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-4">
                  <span className="text-xs font-mono text-slate-300">Community Visual Proof</span>
                </div>
              </div>

              {/* Geographical tag card */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs font-mono">
                <div>
                  <p className="text-slate-500">GEOGRAPHIC COORDS</p>
                  <p className="text-slate-200 font-bold mt-1">
                    LAT: {issue.lat.toFixed(4)} | LNG: {issue.lng.toFixed(4)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">REPORTED TIME</p>
                  <p className="text-slate-300 mt-1">
                    {new Date(issue.createdAt).toLocaleDateString()} at{' '}
                    {new Date(issue.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: AI Analysis + Community Status */}
            <div className="space-y-5">
              <div>
                <h3 className="text-xl font-extrabold text-white tracking-tight">{issue.category}</h3>
                <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-widest">CIVIC REPORT DETAILS</p>
              </div>

              {/* User Description */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">Community Observation</h4>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">{issue.description}</p>
              </div>

              {/* Gemini AI Severity Badge and Analysis */}
              <div className={`border rounded-xl p-4 flex gap-4 ${getSeverityBadgeColor(issue.severityScore)}`}>
                <div className="p-2.5 bg-slate-950/80 rounded-xl h-fit">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider font-mono">AI Assessed Severity:</h4>
                    <span className="font-extrabold text-sm">{issue.severityScore}/5</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300 mt-1.5 font-sans">
                    {issue.severityReasoning}
                  </p>
                </div>
              </div>

              {/* Community Verifications Panel */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Community Verifications</h4>
                  <p className="text-sm font-extrabold text-white mt-1">
                    {issue.verificationCount} {issue.verificationCount === 1 ? 'resident' : 'residents'} verified this
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Auto-verifies at 3 residents</p>
                </div>
                {issue.status === 'reported' ? (
                  <button
                    id="verify-upvote-btn"
                    onClick={() => onUpvote(issue.id)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md hover:shadow-amber-500/10"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Verify Issue
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                    <Check className="w-4 h-4" />
                    Verified Presence
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI-Drafted Escalation Email Template */}
          <div className="border border-indigo-500/20 bg-indigo-950/20 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-indigo-950/60 border-b border-indigo-500/20 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-300">
                <Mail className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono">AI-Generated Municipal Escalation</h4>
              </div>
              <button
                id="copy-draft-btn"
                onClick={handleCopyDraft}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-medium text-slate-200 transition flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                {copied ? 'Copied' : 'Copy Draft'}
              </button>
            </div>
            
            <div className="p-5 space-y-3 text-xs font-mono">
              <div className="flex border-b border-indigo-500/10 pb-2">
                <span className="text-indigo-400/80 w-20 flex-shrink-0">RECIPIENT:</span>
                <span className="text-slate-100">{issue.escalationDraft.recipient}</span>
              </div>
              <div className="flex border-b border-indigo-500/10 pb-2">
                <span className="text-indigo-400/80 w-20 flex-shrink-0">SUBJECT:</span>
                <span className="text-slate-100">{issue.escalationDraft.subject}</span>
              </div>
              <div className="pt-2 text-slate-300 whitespace-pre-line leading-relaxed font-sans max-h-48 overflow-y-auto">
                {issue.escalationDraft.body}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-between gap-3 bg-slate-950/30">
          <div>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">CIVIC ACTION ROOM</p>
            <p className="text-xs font-semibold text-slate-350 mt-0.5">
              {user 
                ? `Signed in as @${user.username} (${user.role})` 
                : 'Sign in to access official dispatch actions'
              }
            </p>
          </div>
          <div className="flex gap-2">
            {user && user.role === 'officer' && issue.status !== 'escalated' && issue.status !== 'resolved' && (
              <button
                id="escalate-action-btn"
                onClick={() => onEscalate(issue.id)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
              >
                <ArrowUpRight className="w-4 h-4" />
                Dispatch Escalation Email
              </button>
            )}
            {user && user.role === 'officer' && issue.status !== 'resolved' && (
              <button
                id="resolve-action-btn"
                onClick={() => onResolve(issue.id)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/10"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as Resolved
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
