import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CivicIssue } from '../types';
import { MapPin, RefreshCw, Layers, ZoomIn, Info } from 'lucide-react';

interface MapViewProps {
  issues?: CivicIssue[];
  selectedIssueId?: string | null;
  onSelectIssue?: (id: string) => void;
  pinningCoords?: { lat: number; lng: number } | null;
  onSetPinningCoords?: (coords: { lat: number; lng: number }) => void;
  isReportingMode?: boolean;
}

export default function MapView({
  issues: propIssues,
  selectedIssueId = null,
  onSelectIssue,
  pinningCoords,
  onSetPinningCoords,
  isReportingMode = false,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const pinningMarkerRef = useRef<L.Marker | null>(null);
  
  const [localIssues, setLocalIssues] = useState<CivicIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayIssues = propIssues || localIssues;

  // 1. Fetch issues if they aren't provided as a prop
  const fetchIssues = async () => {
    if (propIssues) return; // Skip fetching if controlled externally
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/issues');
      if (!response.ok) {
        throw new Error('Failed to fetch issues from the server.');
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setLocalIssues(data);
      }
    } catch (err: any) {
      console.error('Error loading map issues:', err);
      setError('Could not load incident coordinates.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [propIssues]);

  // 2. Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Centered around the middle of local metropolitan region
    const initialCenter: [number, number] = [12.9716, 77.5946];
    const initialZoom = 13;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false, // We can customize or let default
      attributionControl: false,
    });

    // Add CartoDB Dark Matter tile layer for an elegant, tech-focused dark mode design
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Zoom control at bottom right to look cleaner
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Add marker layer group
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    mapRef.current = map;

    // Map click handler for placing pins in reporting mode
    map.on('click', (e: L.LeafletMouseEvent) => {
      // Accessing state variables dynamically in leaflet callbacks needs refs or fresh handlers.
      // We will handle clicks in a separate useEffect or dynamic state check.
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 3. Handle map click registration dynamically to set pinning coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (onSetPinningCoords) {
        const { lat, lng } = e.latlng;
        onSetPinningCoords({ lat, lng });
      }
    };

    map.off('click');
    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [onSetPinningCoords]);

  // 4. Draw pinning marker on the map whenever pinningCoords exist
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pinningMarkerRef.current) {
      map.removeLayer(pinningMarkerRef.current);
      pinningMarkerRef.current = null;
    }

    if (pinningCoords) {
      const pinIcon = L.divIcon({
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; border: 2px dashed #f59e0b; background: rgba(245, 158, 11, 0.15); animation: pulse-glow 2s infinite ease-in-out;"></div>
            <div style="position: absolute; width: 14px; height: 14px; border-radius: 50%; background-color: #ffffff; border: 3px solid #f59e0b; box-shadow: 0 0 10px rgba(245, 158, 11, 0.8);"></div>
          </div>
        `,
        className: 'user-pinning-marker',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const marker = L.marker([pinningCoords.lat, pinningCoords.lng], { icon: pinIcon }).addTo(map);
      pinningMarkerRef.current = marker;
      
      // Center and pan to the selected pinning point
      map.setView([pinningCoords.lat, pinningCoords.lng], 14);
    }
  }, [pinningCoords]);

  // 5. Redraw active issue marker pins when issues list or selection changes
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    displayIssues.forEach((issue) => {
      const isSelected = selectedIssueId === issue.id;
      
      // Determine severity color coding
      const severity = issue.severityScore;
      const markerColor = severity >= 5 ? '#ef4444' : severity >= 4 ? '#f97316' : severity >= 3 ? '#f59e0b' : '#10b981';
      const glowColor = severity >= 5 ? 'rgba(239, 68, 68, 0.45)' : severity >= 4 ? 'rgba(249, 115, 22, 0.45)' : severity >= 3 ? 'rgba(245, 158, 11, 0.45)' : 'rgba(16, 185, 129, 0.45)';
      const pulseClass = severity >= 4 ? 'animation: pulse-glow 1.8s infinite ease-in-out;' : '';

      const isHighSeverity = severity >= 4;
      const sizeMultiplier = isSelected ? 1.4 : 1;

      const markerIcon = L.divIcon({
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: ${32 * sizeMultiplier}px; height: ${32 * sizeMultiplier}px;">
            <div style="position: absolute; width: ${24 * sizeMultiplier}px; height: ${24 * sizeMultiplier}px; border-radius: 50%; background-color: ${glowColor}; ${pulseClass}"></div>
            <div style="position: absolute; width: ${12 * sizeMultiplier}px; height: ${12 * sizeMultiplier}px; border-radius: 50%; background-color: ${markerColor}; border: ${isSelected ? '2px solid #ffffff' : '1.5px solid #ffffff'}; box-shadow: 0 2px 5px rgba(0,0,0,0.4);"></div>
          </div>
        `,
        className: 'custom-incident-marker',
        iconSize: [32 * sizeMultiplier, 32 * sizeMultiplier],
        iconAnchor: [16 * sizeMultiplier, 16 * sizeMultiplier],
      });

      // HTML contents for the popup
      const popupHtml = `
        <div style="font-family: sans-serif; color: #f1f5f9; padding: 2px; width: 210px; background-color: #0f172a; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 10px; font-family: monospace; color: #94a3b8; font-weight: bold; text-transform: uppercase;">MUNICIPAL SECTOR</span>
            <span style="font-size: 10px; font-weight: bold; font-family: monospace; padding: 1px 6px; border-radius: 4px; background: ${markerColor}20; color: ${markerColor}; border: 1px solid ${markerColor}40;">
              Lvl ${severity}
            </span>
          </div>
          <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: #ffffff;">${issue.category}</h4>
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #cbd5e1; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${issue.description}
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #334155; padding-top: 6px;">
            <span style="font-size: 9px; font-family: monospace; color: #64748b; text-transform: uppercase;">Status: ${issue.status}</span>
            <button class="popup-view-btn text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer" data-issue-id="${issue.id}" style="font-size: 10px; border: none; background: none; padding: 0; cursor: pointer; color: #fbbf24; font-family: monospace;">
              VIEW DETAILS &rarr;
            </button>
          </div>
        </div>
      `;

      const marker = L.marker([issue.lat, issue.lng], { icon: markerIcon });
      
      // Bind highly stylized tooltip & popup
      marker.bindPopup(popupHtml, {
        className: 'dark-leaflet-popup',
        maxWidth: 240,
        minWidth: 200,
      });

      markersLayer.addLayer(marker);

      // If this specific issue is selected, center map on it and open popup
      if (isSelected) {
        map.panTo([issue.lat, issue.lng]);
        setTimeout(() => {
          marker.openPopup();
        }, 100);
      }
    });
  }, [displayIssues, selectedIssueId]);

  // 6. Handle click events inside Leaflet Popups using Event Delegation
  const handleMapContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const viewButton = target.closest('.popup-view-btn') as HTMLElement;
    if (viewButton) {
      const issueId = viewButton.getAttribute('data-issue-id');
      if (issueId && onSelectIssue) {
        onSelectIssue(issueId);
      }
    }
  };

  return (
    <div id="leaflet-map-view-card" className="relative bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col h-[450px]">
      {/* Dynamic Keyframes for glowing points */}
      <style>{`
        @keyframes pulse-glow {
          0% { transform: scale(0.75); opacity: 0.4; }
          50% { transform: scale(1.35); opacity: 0.8; }
          100% { transform: scale(0.75); opacity: 0.4; }
        }
        .dark-leaflet-popup .leaflet-popup-content-wrapper {
          background-color: #0f172a !important;
          border: 1px solid #334155 !important;
          border-radius: 12px !important;
          padding: 4px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5) !important;
        }
        .dark-leaflet-popup .leaflet-popup-tip {
          background-color: #0f172a !important;
          border: 1px solid #334155 !important;
        }
        .leaflet-container {
          background-color: #020617 !important;
        }
      `}</style>

      {/* Top Banner overlay */}
      <div className="absolute top-4 left-4 z-[999] bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700/50 flex items-center gap-2.5 shadow-lg">
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-xs font-semibold text-slate-200 uppercase tracking-widest font-mono">
          Interactive Live Dispatch Map
        </span>
      </div>

      {/* Reporting Mode Alert */}
      {isReportingMode && (
        <div className="absolute top-4 right-4 z-[999] bg-amber-500 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 shadow-lg border border-amber-600 animate-bounce">
          <MapPin className="w-4 h-4 animate-bounce" />
          Click Map to Geotag Coordinates
        </div>
      )}

      {/* Reload trigger button (only visible when loading locally) */}
      {!propIssues && (
        <button
          id="reload-map-btn"
          type="button"
          onClick={fetchIssues}
          className="absolute bottom-4 left-4 z-[999] bg-slate-900/95 hover:bg-slate-800 text-slate-300 hover:text-white p-2.5 rounded-xl border border-slate-700/50 shadow-md transition"
          title="Reload Coordinates"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      )}

      {/* Actual Map Canvas Div */}
      <div
        id="leaflet-canvas-container"
        ref={mapContainerRef}
        onClick={handleMapContainerClick}
        className={`w-full h-full transition-all ${
          isReportingMode ? 'cursor-crosshair' : 'cursor-grab'
        }`}
      />

      {/* Legend & Sector Tag Overlay */}
      <div className="absolute bottom-4 right-12 z-[999] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/50 flex gap-3 text-[10px] text-slate-300 font-mono shadow-md items-center">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span>High</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>Critical</span>
        </div>
      </div>
    </div>
  );
}
