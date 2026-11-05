import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
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

// Maharashtra geographic center default
const DEFAULT_CENTER = [19.7515, 75.7139];
const DEFAULT_ZOOM = 7;

// Risk band color definitions matching spec
const BAND_COLORS = {
  Low: { fill: '#16a34a', border: '#14532d' },
  Medium: { fill: '#d97706', border: '#78350f' },
  High: { fill: '#dc2626', border: '#7f1d1d' },
};

/**
 * Controller to dynamically re-fit map bounds when markers filter changes
 */
function FitBounds({ projects }) {
  const map = useMap();

  useEffect(() => {
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
  }, [projects, map]);

  return null;
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
      // District filter
      if (selectedDistrict && p.district && p.district.toLowerCase() !== selectedDistrict.toLowerCase()) {
        return false;
      }
      // Band filter
      const band = p.band || (p.risk_score > 60 ? 'High' : p.risk_score >= 30 ? 'Medium' : 'Low');
      if (!selectedBands[band]) {
        return false;
      }
      return true;
    });
  }, [allProjects, selectedDistrict, selectedBands]);

  const handleBandToggle = (bandKey) => {
    setSelectedBands((prev) => ({
      ...prev,
      [bandKey]: !prev[bandKey],
    }));
  };

  const handleResetFilters = () => {
    setSelectedDistrict('');
    setSelectedBands({ Low: true, Medium: true, High: true });
  };

  // Helper to compute CircleMarker radius based on score (6px - 18px)
  const getMarkerRadius = (score) => {
    const s = Math.max(0, Math.min(100, Number(score) || 0));
    return Math.round(6 + (s / 100) * 12);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto py-4 px-2 sm:px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(244,217,160,0.12)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#F4D9A0] uppercase tracking-widest">
              Geospatial Intelligence
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#201812] text-[#86EFAC] border border-[#255C3A]">
              Live Telemetry
            </span>
          </div>
          <h1 className="text-2xl font-bold font-headline text-[#F4D9A0] mt-1">
            Corridor Risk Map
          </h1>
          <p className="text-xs text-[#C4B5A5] mt-0.5">
            Geospatial alignment visualization with delay probability density and driver overlays
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchProjects}
            disabled={loading}
            className="btn-outline text-xs px-3 py-1.5"
          >
            {loading ? 'Refreshing...' : 'Refresh Telemetry'}
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

        <MapLegend />
      </div>

      {/* Main Map Canvas */}
      <div className="peace-card overflow-hidden relative" style={{ height: '620px' }}>
        {loading && (
          <div className="absolute inset-0 bg-[#140F0B]/85 z-[1000] flex items-center justify-center">
            <Loading message="Loading geospatial project alignment coordinates..." />
          </div>
        )}

        {error && !loading && (
          <div className="p-6">
            <ErrorBox message={error} onRetry={fetchProjects} />
          </div>
        )}

        {!loading && !error && filteredProjects.length === 0 && (
          <div className="absolute inset-0 bg-[#140F0B]/85 z-[1000] flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#1E1611] border border-[rgba(244,217,160,0.2)] text-[#F4D9A0] flex items-center justify-center font-mono font-bold text-lg">
              0
            </div>
            <h3 className="text-sm font-semibold text-[#F4D9A0]">
              No Projects Match Current Map Filters
            </h3>
            <p className="text-xs text-[#C4B5A5] max-w-sm">
              Try selecting additional risk bands or clear the district filter to view corridor markers.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn-outline text-xs px-3 py-1.5"
            >
              Reset Filters
            </button>
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

          <FitBounds projects={filteredProjects} />

          {filteredProjects.map((project) => {
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
                pathOptions={{
                  fillColor: styling.fill,
                  fillOpacity: 0.75,
                  color: styling.border,
                  weight: 2,
                }}
              >
                <Popup className="landsentinel-leaflet-popup">
                  <div className="p-1 space-y-2 font-sans text-xs min-w-[210px] text-[#1E1611]">
                    <div className="flex items-start justify-between gap-2 border-b pb-1.5">
                      <div>
                        <span className="font-mono text-[10px] text-[#8E7E70] block">
                          {project.project_id} {project.district ? `• ${project.district}` : ''}
                        </span>
                        <h4 className="font-bold text-sm text-[#140F0B] leading-tight">
                          {project.name}
                        </h4>
                      </div>
                      <RiskBadge score={project.risk_score} band={band} size="sm" />
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] uppercase font-mono font-semibold text-[#5B4632]">
                        Leading Delay Driver
                      </div>
                      <p className="text-xs text-[#2E231A] leading-snug">
                        {project.top_driver || 'Initial statutory survey in progress.'}
                      </p>
                    </div>

                    <div className="pt-1.5 border-t flex justify-end">
                      <Link
                        to={`/projects/${project.project_id}`}
                        className="inline-flex items-center gap-1 font-semibold text-xs text-[#C8792C] hover:text-[#5B4632]"
                      >
                        Open project &rarr;
                      </Link>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
