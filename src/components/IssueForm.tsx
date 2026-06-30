import React, { useState, useEffect } from 'react';
import { Camera, MapPin, Upload, Sparkles, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface IssueFormProps {
  onSubmit: (formData: { photoUrl: string; description: string; lat: number; lng: number }) => Promise<void>;
  pinningCoords: { lat: number; lng: number } | null;
  onSetPinningCoords: (coords: { lat: number; lng: number }) => void;
  isSubmitting: boolean;
}

const SAMPLE_PRESETS = [
  {
    name: 'Asphalt Pothole',
    description: 'Deep, rugged pothole in the middle of the street lane, causing cars to swerve dangerously.',
    image: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
    lat: 12.9749,
    lng: 77.5994,
  },
  {
    name: 'Sidewalk Water Leak',
    description: 'High pressure water stream burst through pavement tiles, flooding the pedestrian walkway.',
    image: 'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&w=600&q=80',
    lat: 12.9833,
    lng: 77.5967,
  },
  {
    name: 'Broken Streetlight',
    description: 'The overhead lamppost at the corner intersection is fully out, causing pitch-black pedestrian crossings.',
    image: 'https://images.unsplash.com/photo-1508873535684-277a3cbcc4e8?auto=format&fit=crop&w=600&q=80',
    lat: 12.9752,
    lng: 77.6021,
  },
  {
    name: 'Illegal Dumping',
    description: 'A massive pile of broken wooden crates and plastics dumped near the curbside blocking bicycle lanes.',
    image: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
    lat: 12.9691,
    lng: 77.5915,
  },
];

export default function IssueForm({
  onSubmit,
  pinningCoords,
  onSetPinningCoords,
  isSubmitting,
}: IssueFormProps) {
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle');
  const [submitStep, setSubmitStep] = useState(0);

  useEffect(() => {
    if (!isSubmitting) {
      setSubmitStep(0);
      return;
    }

    const intervals = [
      setTimeout(() => setSubmitStep(1), 1000),
      setTimeout(() => setSubmitStep(2), 2400),
      setTimeout(() => setSubmitStep(3), 3800),
    ];

    return () => intervals.forEach(clearTimeout);
  }, [isSubmitting]);

  const triggerGeolocation = () => {
    setGeoStatus('locating');
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        
        onSetPinningCoords(coords);
        setGeoStatus('success');
      },
      (error) => {
        console.warn('Geolocation failed, falling back to simulated coordinate.', error);
        setGeoStatus('error');
        const simulatedLat = 12.965 + Math.random() * 0.02;
        const simulatedLng = 77.585 + Math.random() * 0.02;
        onSetPinningCoords({ lat: simulatedLat, lng: simulatedLng });
      },
      { timeout: 8000 }
    );
  };

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        setPhotoUrl(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  };

  const handleSelectPreset = async (preset: typeof SAMPLE_PRESETS[0]) => {
    setDescription(preset.description);
    onSetPinningCoords({ lat: preset.lat, lng: preset.lng });
    
    try {
      setGeoStatus('success');
      const response = await fetch(preset.image);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPhotoUrl(reader.result);
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      setPhotoUrl(preset.image);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl) {
      alert('Please select an image or click a preset.');
      return;
    }
    if (!description.trim()) {
      alert('Please enter a description.');
      return;
    }
    if (!pinningCoords) {
      alert('Please select a geotag location.');
      return;
    }

    onSubmit({
      photoUrl,
      description,
      lat: pinningCoords.lat,
      lng: pinningCoords.lng,
    }).then(() => {
      setDescription('');
      setPhotoUrl(null);
    });
  };

  return (
    <div id="issue-form-main" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
          <Camera className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">Report Civic Hazard</h2>
          <p className="text-xs text-slate-400">Add photos and locations to alert municipal services</p>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5 font-mono">
          🚀 Instant Demo Presets
        </label>
        <div className="grid grid-cols-2 gap-2">
          {SAMPLE_PRESETS.map((preset, idx) => (
            <button
              id={`preset-item-${idx}`}
              key={idx}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className="text-left px-3 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 rounded-xl transition duration-150 flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-slate-700">
                <img src={preset.image} alt={preset.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-300" referrerPolicy="no-referrer" />
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-200 group-hover:text-amber-400 transition truncate">{preset.name}</p>
                <p className="text-[10px] text-slate-400 truncate">Metropolitan Area</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <form id="issue-form-element" onSubmit={handleFormSubmit} className="space-y-5">
        {/* Photo Upload */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 font-mono">
            Step 1: Upload Hazard Photo
          </label>
          <div
            id="drag-drop-zone-issue"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`relative rounded-xl border-2 border-dashed transition flex flex-col items-center justify-center p-4 min-h-[140px] text-center ${
              dragActive
                ? 'border-amber-400 bg-slate-800/80'
                : photoUrl
                ? 'border-slate-700 bg-slate-950'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
            }`}
          >
            {photoUrl ? (
              <div className="w-full relative flex flex-col items-center">
                <img
                  src={photoUrl}
                  alt="Preview"
                  className="max-h-[140px] rounded-lg object-contain shadow-lg border border-slate-800"
                  referrerPolicy="no-referrer"
                />
                <button
                  id="replace-photo-btn-issue"
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="mt-2.5 text-xs text-amber-400 hover:text-amber-300 underline font-semibold transition"
                >
                  Replace Photo
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-500 mb-2 animate-pulse" />
                <p className="text-xs font-medium text-slate-300">
                  Drag & drop image or{' '}
                  <label className="text-amber-400 hover:text-amber-300 cursor-pointer underline font-semibold">
                    browse
                    <input
                      id="file-upload-input-issue"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                </p>
                <p className="text-[10px] text-slate-500 mt-1">JPEG, PNG files supported</p>
              </>
            )}
          </div>
        </div>

        {/* Geotag capture */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono">
              Step 2: Geotag Location
            </label>
            <button
              id="geotag-btn-issue"
              type="button"
              onClick={triggerGeolocation}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              <MapPin className="w-3.5 h-3.5" />
              Auto Detect
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs">
            {pinningCoords ? (
              <div className="flex items-center gap-2 text-slate-200">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-mono">
                  LAT: <strong className="text-white">{pinningCoords.lat.toFixed(4)}</strong> | LNG:{' '}
                  <strong className="text-white">{pinningCoords.lng.toFixed(4)}</strong>
                </span>
              </div>
            ) : (
              <span className="text-slate-500 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                No coordinates set. Click map or "Auto Detect".
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-mono italic">Active Zone</span>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 font-mono">
            Step 3: Hazard Description
          </label>
          <textarea
            id="description-textarea-issue"
            rows={3}
            placeholder="Write a clear description of the civic problem you observed..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none p-3.5 text-slate-200 placeholder-slate-600 transition"
          />
        </div>

        {/* Progress bar */}
        {isSubmitting && (
          <div className="bg-slate-950/90 border border-amber-500/20 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
              <span className="text-xs font-bold text-slate-200">Agentic AI Processing Timeline</span>
            </div>
            <div className="space-y-2 text-[11px] font-mono">
              <div className={`flex items-center gap-2 ${submitStep >= 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                <span>{submitStep >= 1 ? '✓' : '●'}</span>
                <span>Transmitting visual data payload...</span>
              </div>
              <div className={`flex items-center gap-2 ${submitStep >= 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
                <span>{submitStep >= 2 ? '✓' : '●'}</span>
                <span className={submitStep === 1 ? 'animate-pulse' : ''}>Summoning Gemini-3.5-Flash model...</span>
              </div>
              <div className={`flex items-center gap-2 ${submitStep >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
                <span>{submitStep >= 3 ? '✓' : '●'}</span>
                <span className={submitStep === 2 ? 'animate-pulse' : ''}>Analyzing visual severity & categorizing...</span>
              </div>
              <div className={`flex items-center gap-2 ${submitStep >= 3 ? 'text-amber-400' : 'text-slate-500'}`}>
                <span>{submitStep >= 3 ? '●' : '○'}</span>
                <span className={submitStep === 3 ? 'animate-pulse' : ''}>Drafting professional escalation message...</span>
              </div>
            </div>
          </div>
        )}

        <button
          id="submit-issue-btn-issue"
          type="submit"
          disabled={isSubmitting || !photoUrl || !description.trim() || !pinningCoords}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />
          {isSubmitting ? 'Analyzing & Publishing...' : 'Submit to Gemini Reporter Agent'}
        </button>
      </form>
    </div>
  );
}
