import React, { useState, useEffect } from 'react';
import { CivicIssue } from '../types';
import IssueCard from './IssueCard';
import { Search, SlidersHorizontal, ArrowUpDown, MapPin, RefreshCw, AlertCircle } from 'lucide-react';

interface IssueListProps {
  issues?: CivicIssue[];
  // Optional reference coordinates to calculate proximity sorting (defaults to default center)
  userCoords?: { lat: number; lng: number } | null;
  onSelectIssue?: (id: string) => void;
  selectedIssueId?: string | null;
  onUpvoteIssue?: (id: string, updatedIssue: CivicIssue) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function IssueList({
  issues: propIssues,
  userCoords = { lat: 12.9716, lng: 77.5946 },
  onSelectIssue,
  selectedIssueId = null,
  onUpvoteIssue,
  onRefresh,
  isLoading: propIsLoading = false,
}: IssueListProps) {
  const [localIssues, setLocalIssues] = useState<CivicIssue[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'severity' | 'proximity'>('date');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeIssues = propIssues || localIssues;
  const activeIsLoading = propIssues ? propIsLoading : isLoading;

  // Load issues from Express backend if not provided via props
  const loadIssues = async () => {
    if (propIssues && onRefresh) {
      onRefresh();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/issues');
      if (!response.ok) {
        throw new Error('Failed to retrieve reported civic hazards.');
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setLocalIssues(data);
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to the incident dispatch database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!propIssues) {
      loadIssues();
    }
  }, [propIssues]);

  // Simple Euclidean distance calculation for local sorting relative to user coordinates
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const dLat = lat1 - lat2;
    const dLng = lng1 - lng2;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  };

  // Get unique categories for filtering dropdown
  const categories = ['All', ...Array.from(new Set(activeIssues.map((i) => i.category)))];

  // Apply filters, searches, and sorts
  const processedIssues = activeIssues
    .filter((issue) => {
      const matchesSearch =
        issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || issue.category === selectedCategory;
      const matchesStatus = selectedStatus === 'All' || issue.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'severity') {
        return b.severityScore - a.severityScore;
      }
      if (sortBy === 'proximity' && userCoords) {
        const distA = calculateDistance(a.lat, a.lng, userCoords.lat, userCoords.lng);
        const distB = calculateDistance(b.lat, b.lng, userCoords.lat, userCoords.lng);
        return distA - distB;
      }
      // Default: date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Relay upvote bubble trigger up to the list's parent if required
  const handleCardUpvote = (id: string, updatedIssue?: CivicIssue) => {
    if (updatedIssue) {
      if (!propIssues) {
        setLocalIssues((prev) => prev.map((item) => (item.id === id ? updatedIssue : item)));
      }
      if (onUpvoteIssue) {
        onUpvoteIssue(id, updatedIssue);
      }
    }
  };

  return (
    <div id="issue-list-component" className="space-y-5 text-slate-100">
      {/* Search and Advanced Filter Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg space-y-4">
        {/* Search Input Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="search-input-field"
              type="text"
              placeholder="Search by keywords, categories, descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl pl-10 pr-4 py-3 text-slate-200 placeholder-slate-500 transition"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Refresh issues button */}
            <button
              id="refresh-list-btn"
              type="button"
              onClick={loadIssues}
              className="p-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 rounded-xl transition text-slate-400 hover:text-slate-200"
              title="Reload data"
            >
              <RefreshCw className={`w-4 h-4 ${activeIsLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Sort Toggles */}
            <div className="bg-slate-950 border border-slate-850 p-1 rounded-xl flex items-center">
              <button
                id="sort-date-btn"
                type="button"
                onClick={() => setSortBy('date')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  sortBy === 'date' ? 'bg-slate-850 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                Newest
              </button>
              <button
                id="sort-severity-btn"
                type="button"
                onClick={() => setSortBy('severity')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  sortBy === 'severity' ? 'bg-slate-850 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                Severity
              </button>
              <button
                id="sort-proximity-btn"
                type="button"
                onClick={() => setSortBy('proximity')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  sortBy === 'proximity' ? 'bg-slate-850 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                Proximity
              </button>
            </div>
          </div>
        </div>

        {/* Filters Dropdown Row */}
        <div className="flex flex-wrap items-center gap-3.5 pt-3 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>CATEGORICAL SELECTIONS</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Dropdown */}
            <select
              id="filter-list-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              id="filter-list-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
            >
              <option value="All">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="verified">Verified</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="flex-1 text-right text-[11px] text-slate-500 font-mono">
            Showing {processedIssues.length} of {activeIssues.length} registered reports
          </div>
        </div>
      </div>

      {/* Main Issue Cards Grid */}
      {activeIsLoading ? (
        <div className="py-24 text-center space-y-3 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-slate-400">Loading Incident Database...</p>
        </div>
      ) : error ? (
        <div className="py-16 text-center bg-slate-900 border border-red-950/40 rounded-2xl p-6 text-red-400 flex flex-col items-center gap-2">
          <AlertCircle className="w-8 h-8 text-rose-500" />
          <p className="text-xs font-bold uppercase tracking-widest font-mono">Database Error</p>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">{error}</p>
          <button
            id="retry-load-btn"
            onClick={loadIssues}
            className="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-lg transition"
          >
            Retry Database Connection
          </button>
        </div>
      ) : processedIssues.length === 0 ? (
        <div className="py-20 text-center bg-slate-900/45 border border-dashed border-slate-800 rounded-2xl p-6 text-slate-500 text-xs font-sans">
          No civic incident logs matching current filters found in this sector.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {processedIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              isSelected={selectedIssueId === issue.id}
              onSelect={onSelectIssue}
              onUpvote={handleCardUpvote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
