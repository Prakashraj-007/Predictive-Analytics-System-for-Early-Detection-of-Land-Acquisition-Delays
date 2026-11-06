import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import { parseCadFile } from '../api/cad';

// Fix Vite leaflet icon path
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function FitMapBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      try {
        const b = L.latLngBounds(bounds);
        if (b.isValid()) {
          map.fitBounds(b, { padding: [30, 30], maxZoom: 17 });
        }
      } catch (e) {
        // ignore
      }
    }
  }, [bounds, map]);
  return null;
}

const CLASSIFICATION_COLORS = {
  Private: { fill: '#16a34a', border: '#22c55e', text: '#86efac' },
  Government: { fill: '#d97706', border: '#f59e0b', text: '#fde68a' },
  Forest: { fill: '#9333ea', border: '#a855f7', text: '#d8b4fe' },
};

/**
 * CAD Ingestion Studio Modal.
 * Accepts DXF, GeoJSON, and Zipped Shapefile.
 * Handles CRS, unit scaling, validation report, Leaflet map preview,
 * bidirectional parcel-table highlighting, and CSV export.
 */
export default function CadIngestModal({ isOpen, onClose, onConfirm, declaredAreaHa }) {
  const [file, setFile] = useState(null);
  const [sourceCrs, setSourceCrs] = useState('EPSG:32644');
  const [customCrs, setCustomCrs] = useState('');
  const [units, setUnits] = useState('metres');
  const [loading, setLoading] = useState(false);
  const [dwgError, setDwgError] = useState(null);

  // Parsed CAD State
  const [cadResult, setCadResult] = useState(null);
  const [editableParcels, setEditableParcels] = useState([]);
  const [selectedSurveyNo, setSelectedSurveyNo] = useState(null);
  const [confirmWarningsAccepted, setConfirmWarningsAccepted] = useState(false);

  const tableRowRefs = useRef({});

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setDwgError(null);
      setCadResult(null);
      setEditableParcels([]);
      setSelectedSurveyNo(null);
      setConfirmWarningsAccepted(false);
    }
  }, [isOpen]);

  const effectiveCrs = sourceCrs === 'CUSTOM' ? (customCrs.trim() || 'EPSG:32644') : sourceCrs;

  const isDxf = file && file.name.toLowerCase().endsWith('.dxf');
  const isGeoJson = file && (file.name.toLowerCase().endsWith('.geojson') || file.name.toLowerCase().endsWith('.json'));

  // Handle file input
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    setDwgError(null);
    if (!selected) {
      setFile(null);
      return;
    }

    if (selected.name.toLowerCase().endsWith('.dwg')) {
      setDwgError('Direct DWG binary format is proprietary. Please export your drawing to DXF (AutoCAD Release 2018 or earlier) and re-upload.');
      setFile(null);
      return;
    }

    setFile(selected);
  };

  // Submit file for backend server-side parsing
  const handleParse = async () => {
    if (!file) {
      toast.error('Please select a CAD/GIS file (.dxf, .geojson, or .zip).');
      return;
    }

    setLoading(true);
    setDwgError(null);
    try {
      const res = await parseCadFile(file, {
        sourceCrs: effectiveCrs,
        units,
        declaredAreaHa: declaredAreaHa ? Number(declaredAreaHa) : null,
      });

      setCadResult(res);
      setEditableParcels(res.parcels.map((p) => ({ ...p })));
      setSelectedSurveyNo(res.parcels[0]?.survey_no || null);
      setConfirmWarningsAccepted(false);

      if (res.validation?.is_valid) {
        toast.success(`Successfully parsed ${res.parcels.length} parcels from ${res.filename}!`);
      } else {
        toast.error(`Validation found ${res.validation.errors.length} blocking error(s). Review report below.`);
      }
    } catch (err) {
      console.error('CAD Parsing Error:', err);
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail.message : detail || err.message || 'Failed to parse CAD file.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Table row editing
  const handleUpdateParcelRow = (idx, field, val) => {
    setEditableParcels((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  // Handle map parcel click
  const handleParcelSelect = (surveyNo) => {
    setSelectedSurveyNo(surveyNo);
    const rowEl = tableRowRefs.current[surveyNo];
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Convert GeoJSON geometry coordinates to Leaflet latLngs
  const parseCoordinatesToLatLngs = (geojsonGeom) => {
    if (!geojsonGeom || !geojsonGeom.coordinates) return [];
    const type = geojsonGeom.type;
    if (type === 'Polygon') {
      return geojsonGeom.coordinates[0].map(([lon, lat]) => [lat, lon]);
    } else if (type === 'MultiPolygon') {
      return geojsonGeom.coordinates.map((poly) => poly[0].map(([lon, lat]) => [lat, lon]));
    }
    return [];
  };

  // Extract all points to compute map bounding box
  const mapAllPoints = useMemo(() => {
    const pts = [];
    if (cadResult?.project_boundary?.geojson) {
      const bCoords = parseCoordinatesToLatLngs(cadResult.project_boundary.geojson);
      if (Array.isArray(bCoords[0])) {
        if (typeof bCoords[0][0] === 'number') {
          pts.push(...bCoords);
        } else {
          bCoords.forEach((ring) => pts.push(...ring));
        }
      }
    }
    editableParcels.forEach((p) => {
      if (p.geojson) {
        const pCoords = parseCoordinatesToLatLngs(p.geojson);
        if (Array.isArray(pCoords[0])) {
          if (typeof pCoords[0][0] === 'number') {
            pts.push(...pCoords);
          } else {
            pCoords.forEach((ring) => pts.push(...ring));
          }
        }
      }
    });
    return pts;
  }, [cadResult, editableParcels]);

  // Export Parcels Schedule as CSV
  const handleExportCsv = () => {
    if (editableParcels.length === 0) return;

    let csvContent = 'Survey Number, Area (Hectares), Classification\n';
    editableParcels.forEach((p) => {
      const area = p.record_area_ha !== null && p.record_area_ha !== undefined && p.record_area_ha !== ''
        ? p.record_area_ha
        : p.display_area_ha;
      csvContent += `"${p.survey_no}", ${Number(area).toFixed(2)}, "${p.classification}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${cadResult?.filename?.replace(/\.[^/.]+$/, '') || 'cad'}_parcels_schedule.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Parcels Schedule CSV exported successfully.');
  };

  // Confirm and sync into project creation schedule
  const handleConfirmAndFill = () => {
    if (!cadResult) return;
    if (!cadResult.validation.can_save) {
      toast.error('Cannot save: Resolve all blocking errors first.');
      return;
    }
    if (cadResult.validation.warnings.length > 0 && !confirmWarningsAccepted) {
      toast.error('Please review the validation warnings and check the confirmation box to proceed.');
      return;
    }

    const finalParcels = editableParcels.map((p) => {
      const chosenArea = p.record_area_ha !== null && p.record_area_ha !== undefined && p.record_area_ha !== ''
        ? p.record_area_ha
        : p.display_area_ha;
      const sNo = p.survey_no ? p.survey_no.trim() : (p.survey_number ? p.survey_number.trim() : '');
      return {
        survey_no: sNo,
        survey_number: sNo,
        area_ha: chosenArea,
        computed_area_ha: p.computed_area_ha,
        display_area_ha: p.display_area_ha,
        record_area_ha: p.record_area_ha || null,
        land_type: (p.classification || 'Private').toLowerCase(),
        classification: p.classification || 'Private',
        geojson: p.geojson || p.geometry_geojson,
        geometry_geojson: p.geojson || p.geometry_geojson,
      };
    });

    const totalAreaHa = cadResult.validation?.stats?.total_parcel_area_ha || cadResult.summary?.total_parcel_area_ha || 0;

    onConfirm({
      parcels: finalParcels,
      totalAreaHa,
      projectBoundaryGeojson: cadResult.project_boundary?.geojson,
      boundary_geojson: cadResult.project_boundary?.geojson,
      cadId: cadResult.cad_id,
      cad_id: cadResult.cad_id,
      sourceCrs: cadResult.source_crs,
      source_crs: cadResult.source_crs,
      units: cadResult.units,
      filename: cadResult.filename,
      summary: {
        parcel_count: finalParcels.length,
        total_parcel_area_ha: totalAreaHa,
      },
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="peace-card p-5 sm:p-6 w-full max-w-5xl bg-[#18120D] border border-[rgba(244,217,160,0.3)] shadow-2xl rounded-xl space-y-5 text-xs my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.12)] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#2A1F18] border border-[rgba(244,217,160,0.3)] flex items-center justify-center text-[#F4D9A0] font-headline font-bold text-sm">
              CAD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-headline text-[#F4D9A0]">
                  CAD / GIS Demarcation Ingestion Studio
                </h3>
                <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#2A1F18] text-[#86EFAC] border border-[#255C3A]">
                  AutoCAD DXF • GeoJSON • Shapefile
                </span>
              </div>
              <p className="text-xs text-[#C4B5A5] mt-0.5">
                Upload CAD vector files to auto-extract the outer project boundary, individual survey parcels, and areas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8E7E70] hover:text-[#F4D9A0] font-mono text-base p-1"
          >
            ✕
          </button>
        </div>

        {/* DWG Alert Banner */}
        {dwgError && (
          <div className="p-3.5 bg-[#2B1715] border border-[#F87171] rounded-lg text-xs text-[#FCA5A5] flex items-start gap-2.5 animate-fadeIn">
            <svg className="w-4 h-4 text-[#F87171] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <strong className="block text-white">AutoCAD DWG Format Detected:</strong>
              <span>{dwgError}</span>
            </div>
          </div>
        )}

        {/* Step 1: Upload Controls (CRS & Units) */}
        {!cadResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#140F0B] border border-[#3D2D21] rounded-lg">
              {/* File Dropzone */}
              <div className="md:col-span-1 space-y-1">
                <label className="block text-[#C4B5A5] font-medium text-xs">
                  CAD / GIS File <span className="text-[#F87171]">*</span>
                </label>
                <div className="border border-dashed border-[#5B4632] hover:border-[#C8792C] transition-colors rounded-lg p-3 bg-[#1B140F] flex flex-col items-center justify-center text-center cursor-pointer">
                  <input
                    type="file"
                    accept=".dxf,.geojson,.json,.zip"
                    onChange={handleFileChange}
                    className="w-full text-xs text-[#C4B5A5] file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#2A1F18] file:text-[#F4D9A0] hover:file:bg-[#35271E] file:cursor-pointer cursor-pointer"
                  />
                  <span className="text-[10px] text-[#8E7E70] mt-1.5 font-mono">
                    {file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'DXF, GeoJSON, or Zipped Shapefile'}
                  </span>
                </div>
              </div>

              {/* Source CRS Selector */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[#C4B5A5] font-medium text-xs">
                    Source Coordinate Reference System (CRS) <span className="text-[#F87171]">*</span>
                  </label>
                </div>
                <select
                  value={sourceCrs}
                  onChange={(e) => setSourceCrs(e.target.value)}
                  className="peace-input w-full font-mono text-xs py-1.5"
                >
                  <option value="EPSG:32644">EPSG:32644 (UTM 44N — Eastern & Central Tamil Nadu)</option>
                  <option value="EPSG:32643">EPSG:32643 (UTM 43N — Western Tamil Nadu / Nilgiris)</option>
                  <option value="CUSTOM">Custom EPSG Code...</option>
                </select>
                {sourceCrs === 'CUSTOM' && (
                  <input
                    type="text"
                    value={customCrs}
                    onChange={(e) => setCustomCrs(e.target.value)}
                    placeholder="e.g. EPSG:7760"
                    className="peace-input w-full font-mono text-xs mt-1 py-1"
                  />
                )}
                <span className="text-[10px] text-[#8E7E70] block">
                  {isGeoJson ? 'ℹ️ GeoJSON assumes EPSG:4326 unless declared inside the file.' : 'Used for metric coordinate calculation and WGS84 reprojection.'}
                </span>
              </div>

              {/* Units Selector (Active for DXF) */}
              <div className="space-y-1">
                <label className="block text-[#C4B5A5] font-medium text-xs">
                  Drawing Units (DXF)
                </label>
                <select
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  disabled={isGeoJson}
                  className="peace-input w-full font-mono text-xs py-1.5 disabled:opacity-50"
                >
                  <option value="metres">Metres (Standard metric cadastral)</option>
                  <option value="feet">International Feet (1 ft = 0.3048 m)</option>
                </select>
                <span className="text-[10px] text-[#8E7E70] block">
                  DXF $INSUNITS header variable will be cross-checked during parsing.
                </span>
              </div>
            </div>

            {/* Parse Button */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-mocha text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParse}
                disabled={!file || loading}
                className="btn-amber text-xs px-5 py-2 font-semibold flex items-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Parsing &amp; Validating Geometry...</span>
                  </>
                ) : (
                  <>
                    <span>⚡ Parse &amp; Validate CAD Demarcation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Post-Upload Review, Map & Validation Report */}
        {cadResult && (
          <div className="space-y-5 animate-fadeIn">
            {/* Top Stats & Actions Bar */}
            <div className="p-3 bg-[#140F0B] border border-[#3D2D21] rounded-lg flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
              <div className="flex items-center gap-3">
                <span className="text-[#F4D9A0] font-bold">{cadResult.filename}</span>
                <span className="text-[#8E7E70]">•</span>
                <span className="text-[#86EFAC]">{cadResult.validation.stats.parcels_count} Parcels</span>
                <span className="text-[#8E7E70]">•</span>
                <span className="text-[#FDE68A]">Total Area: {cadResult.validation.stats.total_parcel_area_ha} Ha</span>
                <span className="text-[#8E7E70]">•</span>
                <span className="text-[#C4B5A5]">CRS: {cadResult.source_crs}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="btn-mocha text-[11px] py-1 px-2.5 flex items-center gap-1 font-sans"
                >
                  <span>⬇ Export Schedule CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCadResult(null)}
                  className="text-[11px] text-[#C4B5A5] hover:text-[#F4D9A0] underline px-2 py-1"
                >
                  Upload Another File
                </button>
              </div>
            </div>

            {/* Validation Report Banner */}
            <div className="space-y-2">
              {/* Errors: Blocking */}
              {cadResult.validation.errors.length > 0 && (
                <div className="p-3.5 bg-[#2B1715] border border-[#EF4444] rounded-lg text-xs space-y-1.5">
                  <div className="font-bold text-[#FCA5A5] flex items-center gap-2">
                    <span className="px-1.5 py-0.2 rounded bg-red-900/80 text-white font-mono text-[10px]">
                      {cadResult.validation.errors.length} ERROR(S)
                    </span>
                    <span>Geometric Errors Found — Saving Blocked Until Fixed in CAD:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[#F87171] pl-2 font-mono text-[11px]">
                    {cadResult.validation.errors.map((err, i) => (
                      <li key={i}>{err.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings: Non-blocking but requires acknowledgement */}
              {cadResult.validation.warnings.length > 0 && (
                <div className="p-3 bg-[#261E14] border border-[#F59E0B] rounded-lg text-xs space-y-1.5">
                  <div className="font-bold text-[#FDE68A] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-amber-900/80 text-white font-mono text-[10px]">
                        {cadResult.validation.warnings.length} WARNING(S)
                      </span>
                      <span>Review Geometric Observations &amp; Discrepancies:</span>
                    </div>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[#FCD34D] pl-2 font-mono text-[11px]">
                    {cadResult.validation.warnings.map((warn, i) => (
                      <li key={i}>{warn.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Grid: Map Preview (Left) and Interactive Schedule Table (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Leaflet Interactive Map */}
              <div className="lg:col-span-6 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-[#F4D9A0] uppercase font-semibold">
                    Geospatial Map Preview (WGS84 EPSG:4326)
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="inline-flex items-center gap-1 text-[#86efac]">
                      <span className="w-2.5 h-2.5 rounded bg-[#16a34a] inline-block"></span>
                      Private
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#fde68a]">
                      <span className="w-2.5 h-2.5 rounded bg-[#d97706] inline-block"></span>
                      Govt
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#d8b4fe]">
                      <span className="w-2.5 h-2.5 rounded bg-[#9333ea] inline-block"></span>
                      Forest
                    </span>
                  </div>
                </div>

                <div className="peace-card overflow-hidden relative border border-[rgba(244,217,160,0.2)] rounded-lg" style={{ height: '380px' }}>
                  <MapContainer
                    center={[11.1271, 78.6569]}
                    zoom={12}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%', backgroundColor: '#140F0B' }}
                  >
                    <MapInvalidateSize />
                    <FitMapBounds bounds={mapAllPoints} />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Outer Project Boundary */}
                    {cadResult.project_boundary?.geojson && (
                      <Polygon
                        positions={parseCoordinatesToLatLngs(cadResult.project_boundary.geojson)}
                        pathOptions={{
                          color: '#C8792C',
                          weight: 3,
                          dashArray: '6, 6',
                          fillColor: '#C8792C',
                          fillOpacity: 0.1,
                        }}
                      >
                        <Tooltip direction="top" opacity={0.9}>
                          <div className="text-xs font-sans font-bold">
                            Project Boundary: {cadResult.project_boundary.display_area_ha} Ha
                          </div>
                        </Tooltip>
                      </Polygon>
                    )}

                    {/* Individual Parcels */}
                    {editableParcels.map((parcel, idx) => {
                      if (!parcel.geojson) return null;
                      const isSelected = selectedSurveyNo === parcel.survey_no;
                      const style = CLASSIFICATION_COLORS[parcel.classification] || CLASSIFICATION_COLORS.Private;
                      const latLngs = parseCoordinatesToLatLngs(parcel.geojson);

                      return (
                        <Polygon
                          key={`${parcel.survey_no}-${idx}`}
                          positions={latLngs}
                          eventHandlers={{
                            click: () => handleParcelSelect(parcel.survey_no),
                          }}
                          pathOptions={{
                            color: isSelected ? '#FFFFFF' : style.border,
                            weight: isSelected ? 3.5 : 1.5,
                            fillColor: isSelected ? '#F4D9A0' : style.fill,
                            fillOpacity: isSelected ? 0.85 : 0.5,
                          }}
                        >
                          <Tooltip direction="center" permanent className="bg-transparent border-0 shadow-none">
                            <div className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow ${
                              isSelected ? 'bg-amber-500 text-black' : 'bg-black/80 text-white'
                            }`}>
                              {parcel.survey_no}
                            </div>
                          </Tooltip>
                        </Polygon>
                      );
                    })}
                  </MapContainer>
                </div>
              </div>

              {/* Right Column: Editable Parcels Schedule Table */}
              <div className="lg:col-span-6 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-[#F4D9A0] uppercase font-semibold">
                    Demarcated Parcels Schedule ({editableParcels.length})
                  </span>
                  <span className="text-[10px] text-[#C4B5A5]">
                    Click row to highlight on map
                  </span>
                </div>

                <div className="overflow-x-auto border border-[#3D2D21] rounded-lg max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead className="bg-[#1C140E] text-[#C4B5A5] font-mono text-[10px] uppercase sticky top-0 border-b border-[#3D2D21] z-10">
                      <tr>
                        <th className="py-2 px-2.5">#</th>
                        <th className="py-2 px-2.5">Survey Number</th>
                        <th className="py-2 px-2.5">CAD Area (Ha)</th>
                        <th className="py-2 px-2.5">Record Area (Ha)</th>
                        <th className="py-2 px-2.5">Classification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A1F18] text-[#E8DFD3] text-xs">
                      {editableParcels.map((p, idx) => {
                        const isSelected = selectedSurveyNo === p.survey_no;
                        const hasVariance = p.record_area_ha && Math.abs(Number(p.record_area_ha) - Number(p.display_area_ha)) / Number(p.display_area_ha) > 0.01;

                        return (
                          <tr
                            key={idx}
                            ref={(el) => (tableRowRefs.current[p.survey_no] = el)}
                            onClick={() => setSelectedSurveyNo(p.survey_no)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-[#352518] border-l-4 border-l-[#C8792C]' : 'hover:bg-[#201812]'
                            }`}
                          >
                            <td className="py-1.5 px-2.5 font-mono text-[#8E7E70] text-[11px]">{idx + 1}</td>
                            <td className="py-1.5 px-2.5">
                              <input
                                type="text"
                                value={p.survey_no}
                                onChange={(e) => handleUpdateParcelRow(idx, 'survey_no', e.target.value)}
                                className="peace-input w-full font-mono text-xs py-0.5 px-1.5"
                              />
                            </td>
                            <td className="py-1.5 px-2.5 font-mono font-semibold text-[#F4D9A0]">
                              {p.display_area_ha}
                            </td>
                            <td className="py-1.5 px-2.5">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  value={p.record_area_ha ?? ''}
                                  onChange={(e) => handleUpdateParcelRow(idx, 'record_area_ha', e.target.value)}
                                  placeholder="Optional"
                                  className={`peace-input w-20 font-mono text-xs py-0.5 px-1.5 ${
                                    hasVariance ? 'border-[#F59E0B] text-[#FDE68A]' : ''
                                  }`}
                                />
                                {hasVariance && (
                                  <span className="text-[10px] text-[#F59E0B]" title="Record area differs from CAD area by >1%">
                                    ⚠️
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 px-2.5">
                              <select
                                value={p.classification}
                                onChange={(e) => handleUpdateParcelRow(idx, 'classification', e.target.value)}
                                className="peace-input w-full text-xs py-0.5 px-1 capitalize"
                              >
                                <option value="Private">Private</option>
                                <option value="Government">Government</option>
                                <option value="Forest">Forest</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Warning Confirmation Checkbox if warnings exist */}
            {cadResult.validation.warnings.length > 0 && (
              <div className="p-3 bg-[#1C140E] border border-[#5B4632] rounded-lg flex items-center gap-2.5 text-xs text-[#F3EDE2]">
                <input
                  type="checkbox"
                  id="confirm-cad-warnings"
                  checked={confirmWarningsAccepted}
                  onChange={(e) => setConfirmWarningsAccepted(e.target.checked)}
                  className="rounded border-[#5B4632] text-[#C8792C] focus:ring-[#C8792C] h-4 w-4 bg-[#140F0B]"
                />
                <label htmlFor="confirm-cad-warnings" className="cursor-pointer select-none">
                  I acknowledge and confirm the geometric warnings and area variances above.
                </label>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[rgba(244,217,160,0.12)]">
              <button
                type="button"
                onClick={onClose}
                className="btn-mocha text-xs px-4 py-2"
              >
                Cancel
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleConfirmAndFill}
                  disabled={!cadResult.validation.can_save || (cadResult.validation.warnings.length > 0 && !confirmWarningsAccepted)}
                  className="btn-amber text-xs px-5 py-2 font-semibold flex items-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>✓ Confirm &amp; Fill Schedule</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

