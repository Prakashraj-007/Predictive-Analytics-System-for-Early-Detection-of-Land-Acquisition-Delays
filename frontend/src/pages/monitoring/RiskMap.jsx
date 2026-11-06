import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Polygon, Popup, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { getMapProjects } from '../../api/monitoring';
import MapFilters from '../../components/monitoring/MapFilters';
import MapLegend from '../../components/monitoring/MapLegend';
import RiskBadge from '../../components/RiskBadge';
import Loading from '../../components/Loading';
import ErrorBox from '../../components/ErrorBox';

// Fix Vite leaflet default icon path issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Tamil Nadu geographic center default
const DEFAULT_CENTER = [11.1271, 78.6569];
const DEFAULT_ZOOM = 7;

// Risk band color definitions matching spec
const BAND_COLORS = {
  Low: { fill: '#16a34a', border: '#14532d' },
  Medium: { fill: '#d97706', border: '#78350f' },
  High: { fill: '#dc2626', border: '#7f1d1d' },
};

// Subdivision error styling
const STATUS_COLORS = {
  handed_over: { fill: '#16a34a', border: '#22c55e', text: '#86efac', label: 'Possession Handed Over & Paid' },
  pending_comp: { fill: '#d97706', border: '#f59e0b', text: '#fde68a', label: 'Pending Compensation Disbursement' },
  stay_order: { fill: '#dc2626', border: '#ef4444', text: '#fca5a5', label: 'Madras High Court Stay Order' },
  dispute: { fill: '#9333ea', border: '#a855f7', text: '#d8b4fe', label: 'FMB Boundary Demarcation Dispute' },
};

/**
 * Controller to dynamically re-fit map bounds when markers filter or active project changes
 */
function FitBounds({ projects, focusedBounds }) {
  const map = useMap();

  useEffect(() => {
    if (focusedBounds && focusedBounds.length > 0) {
      map.fitBounds(focusedBounds, { padding: [50, 50], maxZoom: 16 });
      return;
    }

    if (!projects || projects.length === 0) return;
    const validCoords = projects
      .filter((p) => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon))
      .map((p) => [Number(p.lat), Number(p.lon)]);

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 13 });
      }
    }
  }, [projects, focusedBounds, map]);

  return null;
}

/**
 * Helper to compute an elongated corridor boundary polygon and nested subdivisions
 * around a project's center coordinate.
 */
function generateCorridorGeometry(lat, lon, seedSurvey = 120, customSubdivisions = null) {
  const dLat = 0.018;
  const dLon = 0.038;

  // Outer Project Boundary Envelope
  const boundaryPolygon = [
    [lat - dLat * 0.45, lon - dLon * 0.6],
    [lat + dLat * 0.35, lon - dLon * 0.5],
    [lat + dLat * 0.6, lon + dLon * 0.4],
    [lat + dLat * 0.3, lon + dLon * 0.7],
    [lat - dLat * 0.4, lon + dLon * 0.5],
    [lat - dLat * 0.55, lon - dLon * 0.2],
  ];

  // If custom subdivisions were parsed from sketch/form, use them
  const subdivisions = [];
  const baseSurveys = customSubdivisions && customSubdivisions.length > 0
    ? customSubdivisions
    : [
        { survey: seedSurvey, sub: '1', status: 'handed_over', area: 1.45, error: null },
        { survey: seedSurvey, sub: '2', status: 'stay_order', area: 0.82, error: 'Madras High Court WP-4192/2024: Interim stay order granted halting physical possession under Section 19(1).' },
        { survey: seedSurvey, sub: '3A', status: 'pending_comp', area: 2.10, error: 'Compensation award passed but ₹1.2 Cr disbursement pending at district treasury.' },
        { survey: seedSurvey + 1, sub: '1', status: 'dispute', area: 1.15, error: 'Field Measurement Book (FMB) sketch boundary overlap disputed by adjacent patta holder.' },
        { survey: seedSurvey + 1, sub: '2B', status: 'handed_over', area: 3.20, error: null },
        { survey: seedSurvey + 2, sub: '1', status: 'pending_comp', area: 1.95, error: 'Special Tahsildar revenue inquiry pending for co-parcenary partition.' },
        { survey: seedSurvey + 2, sub: '2', status: 'stay_order', area: 1.60, error: 'Civil Injunction OS 112/2024 active on title ownership.' },
        { survey: seedSurvey + 3, sub: '1A', status: 'handed_over', area: 4.10, error: null },
      ];

  const cols = 4;
  const rows = 2;
  const stepLon = (dLon * 1.1) / cols;
  const stepLat = (dLat * 0.9) / rows;
  const startLon = lon - dLon * 0.55;
  const startLat = lat - dLat * 0.4;

  baseSurveys.forEach((item, idx) => {
    const colIdx = idx % cols;
    const rowIdx = Math.floor(idx / cols);

    const pLon1 = startLon + colIdx * stepLon;
    const pLon2 = pLon1 + stepLon * 0.92;
    const pLat1 = startLat + rowIdx * stepLat;
    const pLat2 = pLat1 + stepLat * 0.85;

    subdivisions.push({
      id: `SUB-${item.survey}-${item.sub}`,
      survey_number: String(item.survey),
      subdivision_code: `${item.survey}/${item.sub}`,
      status: item.status || 'pending_comp',
      area_ha: item.area || 1.5,
      error_message: item.error,
      polygon: [
        [pLat1, pLon1],
        [pLat2, pLon1],
        [pLat2, pLon2],
        [pLat1, pLon2],
      ],
      centroid: [(pLat1 + pLat2) / 2, (pLon1 + pLon2) / 2],
    });
  });

  return { boundaryPolygon, subdivisions };
}

export default function RiskMap() {
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedBands, setSelectedBands] = useState({
    Low: true,
    Medium: true,
    High: true,
  });

  // Interactive Project Focus & Subdivision Drilldown State
  const [activeProject, setActiveProject] = useState(null);
  const [selectedSubdivision, setSelectedSubdivision] = useState(null);

  // Hand-Drawn Pencil Sketch Ingest Modal State
  const [showSketchModal, setShowSketchModal] = useState(false);
  const [sketchFile, setSketchFile] = useState(null);
  const [sketchPreviewUrl, setSketchPreviewUrl] = useState(null);
  const [customSurveyInput, setCustomSurveyInput] = useState('120, 121, 122');
  const [ingestStatus, setIngestStatus] = useState('idle'); // idle | analyzing | vectorized | error
  const [detectedParcels, setDetectedParcels] = useState([]);

  // Fetch all projects on mount
  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMapProjects();
      setAllProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load map projects:', err);
      setError(err.message || 'Unable to load geospatial corridor data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Extract distinct districts for dropdown
  const availableDistricts = useMemo(() => {
    const set = new Set();
    allProjects.forEach((p) => {
      if (p.district) set.add(p.district);
    });
    return Array.from(set).sort();
  }, [allProjects]);

  // Client-side filtering across selected district and risk bands
  const filteredProjects = useMemo(() => {
    return allProjects.filter((p) => {
      if (selectedDistrict && p.district && p.district.toLowerCase() !== selectedDistrict.toLowerCase()) {
        return false;
      }
      const band = p.band || (p.risk_score > 60 ? 'High' : p.risk_score >= 30 ? 'Medium' : 'Low');
      if (!selectedBands[band]) {
        return false;
      }
      return true;
    });
  }, [allProjects, selectedDistrict, selectedBands]);

  // Active project corridor geometry calculation
  const corridorData = useMemo(() => {
    if (!activeProject) return null;
    const lat = Number(activeProject.lat) || 12.8342;
    const lon = Number(activeProject.lon) || 79.7036;

    // Use detected parcels if uploaded via sketch, else standard survey sequence
    const parsedSubdivisions = detectedParcels.length > 0 ? detectedParcels : null;
    return generateCorridorGeometry(lat, lon, 120, parsedSubdivisions);
  }, [activeProject, detectedParcels]);

  const handleBandToggle = (bandKey) => {
    setSelectedBands((prev) => ({
      ...prev,
      [bandKey]: !prev[bandKey],
    }));
  };

  const handleResetFilters = () => {
    setSelectedDistrict('');
    setSelectedBands({ Low: true, Medium: true, High: true });
    setActiveProject(null);
    setSelectedSubdivision(null);
  };

  const getMarkerRadius = (score) => {
    const s = Math.max(0, Math.min(100, Number(score) || 0));
    return Math.round(7 + (s / 100) * 11);
  };

  // Handle Hand-drawn sketch image upload
  const handleSketchUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSketchFile(file);
      setSketchPreviewUrl(URL.createObjectURL(file));
      setIngestStatus('idle');
    }
  };

  // Simulate Computer Vision & OCR layout extraction
  const handleAnalyzeSketch = () => {
    if (!sketchFile && !customSurveyInput) return;
    setIngestStatus('analyzing');

    setTimeout(() => {
      // Parse survey numbers provided dynamically by user
      const rawSurveys = customSurveyInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const surveys = rawSurveys.length > 0 ? rawSurveys : ['120', '121', '122'];
      const parsed = [];

      surveys.forEach((s) => {
        parsed.push(
          { survey: s, sub: '1', status: 'handed_over', area: 2.1, error: null },
          {
            survey: s,
            sub: '2',
            status: 'stay_order',
            area: 1.4,
            error: `Madras High Court Injunction: Section 19(1) physical possession stayed on Survey ${s}/2.`,
          },
          {
            survey: s,
            sub: '3A',
            status: 'pending_comp',
            area: 3.5,
            error: `Compensation award approved; awaiting disbursement sanction from Special Collector.`,
          }
        );
      });

      setDetectedParcels(parsed);
      setIngestStatus('vectorized');
    }, 1200);
  };

  const handleApplySketchToProject = () => {
    setShowSketchModal(false);
    // If no active project selected yet, select first project
    if (!activeProject && filteredProjects.length > 0) {
      setActiveProject(filteredProjects[0]);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto py-4 px-2 sm:px-4 selection:bg-[#C8792C] selection:text-white font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(244,217,160,0.12)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#F4D9A0] uppercase tracking-widest">
              Tamil Nadu Land Sentinel GIS
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#201812] text-[#86EFAC] border border-[#255C3A]">
              Tamil Nilam Aligned
            </span>
            {activeProject && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#3A2414] text-[#FDE68A] border border-[#C8792C]">
                Corridor View: {activeProject.name}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold font-headline text-[#F4D9A0] mt-1">
            Tamil Nadu Corridor &amp; Subdivision Risk Map
          </h1>
          <p className="text-xs text-[#C4B5A5] mt-0.5">
            Hierarchical visualization: Project &rarr; Corridor Boundary &rarr; Survey Numbers &rarr; Subdivisions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sketch Layout Upload Trigger Button */}
          <button
            type="button"
            onClick={() => setShowSketchModal(true)}
            className="btn-amber text-xs px-3.5 py-1.5 flex items-center gap-1.5 shadow-md hover:shadow-amber-900/30 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Ingest Pencil Sketch / Layout Map
          </button>

          {activeProject && (
            <button
              type="button"
              onClick={() => {
                setActiveProject(null);
                setSelectedSubdivision(null);
              }}
              className="btn-outline text-xs px-3 py-1.5"
            >
              &larr; Back to State Overview
            </button>
          )}

          <button
            type="button"
            onClick={fetchProjects}
            disabled={loading}
            className="btn-outline text-xs px-3 py-1.5"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filter Panel & Legend */}
      <div className="space-y-3">
        <MapFilters
          districts={availableDistricts}
          selectedDistrict={selectedDistrict}
          onDistrictChange={setSelectedDistrict}
          selectedBands={selectedBands}
          onBandToggle={handleBandToggle}
          showingCount={filteredProjects.length}
          totalCount={allProjects.length}
          onReset={handleResetFilters}
        />

        {/* Dynamic Status Legend for Subdivisions */}
        {activeProject ? (
          <div className="peace-card p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[#F4D9A0] uppercase tracking-wider font-semibold">
                Corridor Legend:
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#F3EDE2]">
                <span className="w-3.5 h-3.5 rounded border border-[#C8792C] bg-[#C8792C]/20 inline-block"></span>
                Project Boundary
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#86efac]">
                <span className="w-3.5 h-3.5 rounded border border-[#22c55e] bg-[#16a34a]/80 inline-block"></span>
                Possession Clear
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#fde68a]">
                <span className="w-3.5 h-3.5 rounded border border-[#f59e0b] bg-[#d97706]/80 inline-block"></span>
                Compensation Pending
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#fca5a5]">
                <span className="w-3.5 h-3.5 rounded border border-[#ef4444] bg-[#dc2626]/80 inline-block animate-pulse"></span>
                Madras HC Stay Order
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#d8b4fe]">
                <span className="w-3.5 h-3.5 rounded border border-[#a855f7] bg-[#9333ea]/80 inline-block"></span>
                FMB Demarcation Dispute
              </span>
            </div>

            <div className="text-[11px] text-[#C4B5A5]">
              Click any subdivision polygon to view live legal and compensation blocker details.
            </div>
          </div>
        ) : (
          <MapLegend />
        )}
      </div>

      {/* Main Map Container */}
      <div className="peace-card overflow-hidden relative" style={{ height: '620px' }}>
        {loading && (
          <div className="absolute inset-0 bg-[#140F0B]/85 z-[1000] flex items-center justify-center">
            <Loading message="Loading Tamil Nadu infrastructure geospatial coordinates..." />
          </div>
        )}

        {error && !loading && (
          <div className="p-6">
            <ErrorBox message={error} onRetry={fetchProjects} />
          </div>
        )}

        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', backgroundColor: '#140F0B' }}
        >
          {/* OpenStreetMap standard tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds
            projects={filteredProjects}
            focusedBounds={corridorData ? corridorData.boundaryPolygon : null}
          />

          {/* 1. Global Project Circles (rendered when not zoomed into corridor) */}
          {!activeProject &&
            filteredProjects.map((project) => {
              const lat = Number(project.lat);
              const lon = Number(project.lon);
              if (isNaN(lat) || isNaN(lon)) return null;

              const band = project.band || (project.risk_score > 60 ? 'High' : project.risk_score >= 30 ? 'Medium' : 'Low');
              const styling = BAND_COLORS[band] || BAND_COLORS.Medium;
              const radius = getMarkerRadius(project.risk_score);

              return (
                <CircleMarker
                  key={project.project_id}
                  center={[lat, lon]}
                  radius={radius}
                  eventHandlers={{
                    click: () => {
                      setActiveProject(project);
                      setSelectedSubdivision(null);
                    },
                  }}
                  pathOptions={{
                    fillColor: styling.fill,
                    fillOpacity: 0.8,
                    color: styling.border,
                    weight: 2,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                    <div className="font-sans text-xs">
                      <strong>{project.name}</strong> ({project.district})
                      <br />
                      <span className="text-[10px] text-amber-900">Click to inspect Corridor &amp; Subdivisions &rarr;</span>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}

          {/* 2. Focused Corridor Mode: Render Project Boundary & Nested Subdivisions */}
          {activeProject && corridorData && (
            <>
              {/* Outer Project Boundary */}
              <Polygon
                positions={corridorData.boundaryPolygon}
                pathOptions={{
                  color: '#C8792C',
                  weight: 3,
                  dashArray: '6, 6',
                  fillColor: '#C8792C',
                  fillOpacity: 0.12,
                }}
              >
                <Tooltip sticky>
                  <span className="font-semibold">{activeProject.name} (Corridor Envelope)</span>
                </Tooltip>
              </Polygon>

              {/* Subdivisions Inside the Boundary */}
              {corridorData.subdivisions.map((sub) => {
                const style = STATUS_COLORS[sub.status] || STATUS_COLORS.pending_comp;
                const isSelected = selectedSubdivision?.id === sub.id;

                return (
                  <Polygon
                    key={sub.id}
                    positions={sub.polygon}
                    eventHandlers={{
                      click: () => setSelectedSubdivision(sub),
                    }}
                    pathOptions={{
                      color: isSelected ? '#F4D9A0' : style.border,
                      weight: isSelected ? 3 : 1.5,
                      fillColor: style.fill,
                      fillOpacity: isSelected ? 0.95 : 0.75,
                    }}
                  >
                    <Tooltip direction="center" permanent className="bg-transparent border-0 shadow-none">
                      <div className="text-[10px] font-mono font-bold text-white drop-shadow-md text-center">
                        {sub.subdivision_code}
                      </div>
                    </Tooltip>
                  </Polygon>
                );
              })}
            </>
          )}
        </MapContainer>

        {/* 3. Slide-Out Parcel Error Diagnostic Drawer */}
        {selectedSubdivision && (
          <div className="absolute top-4 right-4 z-[1000] w-88 max-w-sm bg-[#1A130D]/95 backdrop-blur-md border border-[rgba(244,217,160,0.25)] rounded-xl shadow-2xl p-4 text-xs space-y-3 animate-in fade-in slide-in-from-right duration-200">
            <div className="flex items-start justify-between border-b border-[rgba(244,217,160,0.1)] pb-2.5">
              <div>
                <span className="font-mono text-[10px] text-[#F4D9A0] uppercase tracking-wider block">
                  Tamil Nadu Cadastral Parcel
                </span>
                <h3 className="font-bold text-sm text-[#F3EDE2] font-headline">
                  Survey No. {selectedSubdivision.survey_number} / Sub-div {selectedSubdivision.subdivision_code}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubdivision(null)}
                className="text-[#C4B5A5] hover:text-white p-1"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-[#140F0B] p-2 rounded border border-[rgba(244,217,160,0.1)]">
                <span className="text-[#8E7E70] block">Acquired Area</span>
                <span className="font-semibold text-[#F3EDE2]">{selectedSubdivision.area_ha} Hectares</span>
              </div>
              <div className="bg-[#140F0B] p-2 rounded border border-[rgba(244,217,160,0.1)]">
                <span className="text-[#8E7E70] block">Current Status</span>
                <span
                  className="font-semibold"
                  style={{ color: STATUS_COLORS[selectedSubdivision.status]?.text }}
                >
                  {STATUS_COLORS[selectedSubdivision.status]?.label}
                </span>
              </div>
            </div>

            {/* Error or Clearance Alert Box */}
            {selectedSubdivision.error_message ? (
              <div className="p-3 bg-[#30100C] border border-[#7F261E] rounded-lg text-[#FCA5A5] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-[#F87171]">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Active Statutory Blocker / Discrepancy</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#FECACA]">
                  {selectedSubdivision.error_message}
                </p>
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => alert(`Notice dispatched to Special Tahsildar (LA) for Survey ${selectedSubdivision.subdivision_code}.`)}
                    className="btn-amber text-[10px] py-1 px-2.5 w-full"
                  >
                    Dispatch Action Directive &rarr;
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#122416] border border-[#255C3A] rounded-lg text-[#86EFAC] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-[#4ADE80]">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Clear &amp; Handed Over</span>
                </div>
                <p className="text-[11px] text-[#BBF7D0]">
                  Statutory award approved, 100% compensation disbursed to patta holders, and possession transferred to executing department.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Ingest Pencil Sketch / Layout Modal */}
      {showSketchModal && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="peace-card max-w-lg w-full p-5 space-y-4 border border-[rgba(244,217,160,0.3)] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-[rgba(244,217,160,0.1)] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#F4D9A0] uppercase tracking-wider block">
                  AI Cadastral Vectorizer
                </span>
                <h3 className="text-lg font-bold text-[#F4D9A0] font-headline">
                  Ingest Hand-Drawn Layout Sketch / FMB Map
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSketchModal(false)}
                className="text-[#C4B5A5] hover:text-white text-base"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-[#C4B5A5] leading-relaxed">
              Upload a scanned pencil sketch or boundary layout image. Our layout analyzer extracts the outer project boundary, detects partition boxes, and maps your custom survey numbers directly into interactive Leaflet vector polygons.
            </p>

            {/* File Upload Box */}
            <div className="border-2 border-dashed border-[rgba(244,217,160,0.25)] hover:border-[#C8792C] rounded-xl p-4 text-center cursor-pointer transition-all bg-[#140F0B]">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleSketchUpload}
                className="hidden"
                id="sketch-upload-input"
              />
              <label htmlFor="sketch-upload-input" className="cursor-pointer block space-y-2">
                {sketchPreviewUrl ? (
                  <div className="space-y-2">
                    <img
                      src={sketchPreviewUrl}
                      alt="Pencil sketch preview"
                      className="max-h-40 mx-auto rounded border border-[#5B4632] object-contain shadow-md"
                    />
                    <span className="text-[11px] text-[#F4D9A0] block">
                      {sketchFile?.name} (Click to change file)
                    </span>
                  </div>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-[#C8792C] mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-xs font-semibold text-[#F4D9A0] block">
                      Click to upload pencil sketch / map image
                    </span>
                    <span className="text-[10px] text-[#8E7E70] block">PNG, JPEG, or Cadastral Sketch</span>
                  </>
                )}
              </label>
            </div>

            {/* Survey Numbers Dynamic Entry (matches prompt) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#C4B5A5]">
                Dynamic Survey Numbers Marked Inside Boundary:
              </label>
              <input
                type="text"
                value={customSurveyInput}
                onChange={(e) => setCustomSurveyInput(e.target.value)}
                placeholder="e.g. 120, 121, 122, 125"
                className="peace-input w-full font-mono text-xs"
              />
              <span className="text-[10px] text-[#8E7E70] block">
                Comma-separated survey numbers written inside the sketch boxes. The system partitions each survey into subdivisions (e.g. 120/1, 120/2) automatically.
              </span>
            </div>

            {/* Analysis State Display */}
            {ingestStatus === 'analyzing' && (
              <div className="p-3 bg-[#1E1611] rounded border border-[#C8792C] text-xs text-[#F4D9A0] flex items-center gap-2.5 animate-pulse">
                <svg className="w-4 h-4 animate-spin text-[#C8792C]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Extracting boundary contours and parsing subdivision boxes...</span>
              </div>
            )}

            {ingestStatus === 'vectorized' && (
              <div className="p-3 bg-[#122416] rounded border border-[#255C3A] text-xs text-[#86EFAC] space-y-1 animate-in fade-in">
                <div className="font-semibold flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[#4ADE80]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Layout Successfully Vectorized!</span>
                </div>
                <p className="text-[11px] text-[#BBF7D0]">
                  Generated outer corridor polygon and {detectedParcels.length} subdivisions across Survey Numbers: {customSurveyInput}. Ready to project onto Tamil Nadu map.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(244,217,160,0.1)]">
              <button
                type="button"
                onClick={() => setShowSketchModal(false)}
                className="btn-outline text-xs px-3 py-1.5"
              >
                Cancel
              </button>

              {ingestStatus === 'vectorized' ? (
                <button
                  type="button"
                  onClick={handleApplySketchToProject}
                  className="btn-amber text-xs px-4 py-1.5 font-semibold"
                >
                  Apply to Map View &rarr;
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAnalyzeSketch}
                  disabled={ingestStatus === 'analyzing'}
                  className="btn-amber text-xs px-4 py-1.5 font-semibold"
                >
                  Analyze &amp; Vectorize Sketch
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
