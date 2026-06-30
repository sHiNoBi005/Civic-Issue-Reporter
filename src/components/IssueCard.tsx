import React, { useState } from 'react';
import { CivicIssue } from '../types';
import { 
  ChevronDown, 
  ChevronUp, 
  ThumbsUp, 
  Mail, 
  AlertTriangle, 
  Check, 
  MapPin, 
  Calendar, 
  Award 
} from 'lucide-react';

interface IssueCardProps {
  key?: any;
  issue: CivicIssue;
  onUpvote?: any;
  onSelect?: any;
  isSelected?: boolean;
}

export default function IssueCard({
  issue,
  onUpvote,
  onSelect,
  isSelected = false,
}: IssueCardProps) {
  const [isLetterExpanded, setIsLetterExpanded] = useState(false);
  const [isUpvoting, setIsUpvoting] = useState(false);
  const [localVerificationCount, setLocalVerificationCount] = useState(issue.verificationCount);
  const [hasUpvoted, setHasUpvoted] = useState(false);

  // Keep local count in sync if prop changes
  React.useEffect(() => {
    setLocalVerificationCount(issue.verificationCount);
  }, [issue.verificationCount]);

  const handleUpvoteClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card selection if clicked inside App.tsx list view
    if (isUpvoting || hasUpvoted) return;

    setIsUpvoting(true);
    try {
      const response = await fetch(`/api/issues/${issue.id}/upvote`, {
        method: 'POST',
      });
      if (response.ok) {
        const updatedIssue = await response.json();
        setLocalVerificationCount(updatedIssue.verificationCount);
        setHasUpvoted(true);
        if (onUpvote) {
          onUpvote(issue.id, updatedIssue);
        }
      } else {
        console.error('Failed to upvote issue');
      }
    } catch (err) {
      console.error('Error upvoting issue:', err);
    } finally {
      setIsUpvoting(false);
    }
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
    <div
      id={`issue-card-container-${issue.id}`}
      onClick={() => onSelect && onSelect(issue.id)}
      className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-300 shadow-lg flex flex-col h-full cursor-pointer ${
        isSelected 
          ? 'border-amber-500 ring-1 ring-amber-500/30 bg-slate-900/90' 
          : 'border-slate-800 hover:border-slate-700 hover:shadow-xl bg-slate-900/60'
      }`}
    >
      {/* Photo section */}
      <div className="relative aspect-video w-full bg-slate-950 overflow-hidden border-b border-slate-800/80">
        <img
          src={issue.photoUrl}
          alt={issue.category}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          referrerPolicy="no-referrer"
        />
        {/* Severity score floating badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg border shadow-lg backdrop-blur-md ${getSeverityBadgeColor(issue.severityScore)}`}>
            Severity: {issue.severityScore}/5
          </span>
        </div>

        {/* Status badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border shadow-md backdrop-blur-md ${getStatusBadgeColor(issue.status)}`}>
            {issue.status}
          </span>
        </div>
      </div>

      {/* Info details body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          {/* Category & coordinates */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              <span>Municipal Sector</span>
            </span>
            <span className="text-[10px]">
              LAT: {issue.lat.toFixed(3)} | LNG: {issue.lng.toFixed(3)}
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2 group-hover:text-amber-400 transition-colors">
            {issue.category}
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed font-sans line-clamp-3">
            {issue.description}
          </p>

          {/* AI Severity Reasoning */}
          {issue.severityReasoning && (
            <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-3 flex gap-2.5 mt-2.5 text-[11px] text-slate-400">
              <AlertTriangle className="w-4 h-4 text-amber-500/80 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-300">AI Assessment: </span>
                <span>{issue.severityReasoning}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action area */}
        <div className="pt-2 border-t border-slate-800/60 space-y-3">
          {/* Upvote & general verifications row */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono text-[11px]">
              {localVerificationCount} Verification{localVerificationCount !== 1 ? 's' : ''}
            </span>

            <button
              id={`upvote-btn-card-${issue.id}`}
              type="button"
              onClick={handleUpvoteClick}
              disabled={isUpvoting || hasUpvoted}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
                hasUpvoted
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 active:scale-95 disabled:opacity-65'
              }`}
            >
              {hasUpvoted ? <Check className="w-3.5 h-3.5" /> : <ThumbsUp className="w-3.5 h-3.5" />}
              {isUpvoting ? 'Verifying...' : hasUpvoted ? 'Verified' : 'Verify Issue'}
            </button>
          </div>

          {/* AI-drafted Escalation Letter Collapsible section */}
          {issue.escalationDraft && (
            <div id={`collapsible-letter-${issue.id}`} className="border border-slate-800/80 bg-slate-950/20 rounded-xl overflow-hidden">
              <button
                id={`toggle-letter-btn-${issue.id}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLetterExpanded(!isLetterExpanded);
                }}
                className="w-full px-4 py-2.5 bg-slate-950/40 hover:bg-slate-950/80 text-xs font-semibold text-slate-300 flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-1.5 text-indigo-400 font-mono text-[11px]">
                  <Mail className="w-3.5 h-3.5" />
                  AI Escalation Letter
                </span>
                {isLetterExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {isLetterExpanded && (
                <div 
                  id={`letter-content-${issue.id}`} 
                  onClick={(e) => e.stopPropagation()} // Stop modal selection on scroll or copy
                  className="p-4 border-t border-slate-850/80 text-[11px] font-mono space-y-2.5 max-h-56 overflow-y-auto bg-slate-950/60 animate-fade-in"
                >
                  <div className="flex border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500 w-16 flex-shrink-0">TO:</span>
                    <span className="text-slate-300 truncate">{issue.escalationDraft.recipient}</span>
                  </div>
                  <div className="flex border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500 w-16 flex-shrink-0">SUBJECT:</span>
                    <span className="text-slate-300 truncate">{issue.escalationDraft.subject}</span>
                  </div>
                  <div className="pt-1.5 text-slate-300 whitespace-pre-line leading-relaxed font-sans text-xs">
                    {issue.escalationDraft.body}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
