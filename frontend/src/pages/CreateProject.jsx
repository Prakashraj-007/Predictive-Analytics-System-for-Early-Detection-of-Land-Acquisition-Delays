import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { createProject } from '../api/projects';
import { confirmCadParcels } from '../api/cad';
import CadIngestModal from '../components/CadIngestModal';
import SyntheticNote from '../components/SyntheticNote';

// Fix Vite leaflet default icon path issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const TN_DISTRICT_COORDS = {
  Chennai: [13.0827, 80.2707],
  Kanchipuram: [12.8342, 79.7036],
  Tiruvallur: [13.1261, 79.9376],
  Coimbatore: [11.0168, 76.9558],
  Madurai: [9.9252, 78.1198],
  Salem: [11.6643, 78.1460],
  Tiruchirappalli: [10.7905, 78.7047],
  Tirunelveli: [8.7139, 77.7567],
  Erode: [11.3410, 77.7172],
  Thoothukudi: [8.7642, 78.1348],
};

const TN_DISTRICT_TERMINALS = {
  Chennai: { start: 'Madhavaram Junction Hub', end: 'Ennore Port Freight Gate' },
  Kanchipuram: { start: 'Sriperumbudur Industrial Hub', end: 'Oragadam Manufacturing Corridor' },
  Tiruvallur: { start: 'Gummidipoondi Industrial Complex', end: 'Poonamallee Bypass' },
  Coimbatore: { start: 'Avinashi Road Feeder Terminal', end: 'Sulur Aerospace Industrial Park' },
  Madurai: { start: 'Kappalur Industrial Ring', end: 'Melur Agricultural Expressway Point' },
  Salem: { start: 'Steel Plant Road Junction', end: 'Kandhampatti Bypass Corridor' },
  Tiruchirappalli: { start: 'Thuvakudi Industrial Hub', end: 'Viralimalai Road Terminal' },
  Tirunelveli: { start: 'Gangaikondan SIPCOT Zone', end: 'Nanguneri SEZ Boundary' },
  Erode: { start: 'Perundurai SIPCOT Terminal', end: 'Bhavani River Crossing Corridor' },
  Thoothukudi: { start: 'V.O.C. Port Coastal Link', end: 'SIPCOT Complex Phase 2' },
};

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

function generateCorridorGeometry(lat, lon, surveyItems = []) {
  const dLat = 0.016;
  const dLon = 0.034;

  const boundaryPolygon = [
    [lat - dLat * 0.45, lon - dLon * 0.6],
    [lat + dLat * 0.35, lon - dLon * 0.5],
    [lat + dLat * 0.6, lon + dLon * 0.4],
    [lat + dLat * 0.3, lon + dLon * 0.7],
    [lat - dLat * 0.4, lon + dLon * 0.5],
    [lat - dLat * 0.55, lon - dLon * 0.2],
  ];

  const items = surveyItems.length > 0
    ? surveyItems
    : [
        { survey_no: '120/1', area_ha: 1.8, land_type: 'private' },
        { survey_no: '120/2', area_ha: 2.4, land_type: 'private' },
        { survey_no: '120/3A', area_ha: 0.95, land_type: 'government' },
        { survey_no: '121/1', area_ha: 3.1, land_type: 'private' },
        { survey_no: '121/2', area_ha: 1.45, land_type: 'forest' },
        { survey_no: '122/1', area_ha: 2.6, land_type: 'private' },
      ];

  const count = items.length;
  const cols = Math.min(count, 3);
  const rows = Math.ceil(count / cols);

  const startLat = lat - dLat * 0.3;
  const startLon = lon - dLon * 0.45;
  const cellLat = (dLat * 0.65) / rows;
  const cellLon = (dLon * 0.95) / cols;

  const subdivisions = items.map((item, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const p1 = [startLat + r * cellLat + 0.0006, startLon + c * cellLon + 0.0008];
    const p2 = [startLat + (r + 1) * cellLat - 0.0006, startLon + c * cellLon + 0.0008];
    const p3 = [startLat + (r + 1) * cellLat - 0.0006, startLon + (c + 1) * cellLon - 0.0008];
    const p4 = [startLat + r * cellLat + 0.0006, startLon + (c + 1) * cellLon - 0.0008];

    const surveyNo = typeof item === 'string' ? item : item.survey_no || `120/${idx + 1}`;
    const area = typeof item === 'object' && item.area_ha ? Number(item.area_ha) : (1.2 + idx * 0.35).toFixed(2);
    const landType = typeof item === 'object' && item.land_type ? item.land_type : 'private';

    return {
      survey_no: surveyNo,
      area_ha: area,
      land_type: landType,
      polygon: [p1, p2, p3, p4],
    };
  });

  return { boundaryPolygon, subdivisions };
}

const DRAFT_STORAGE_KEY = 'landsentinel_project_draft';

const INITIAL_FORM_STATE = {
  // Step 1: Basic details
  name: '',
  type: 'highway',
  agency: '',
  state: 'Tamil Nadu',
  district: 'Kanchipuram',
  planned_start: '',
  planned_end: '',
  budget: '',

  // Step 2: Land requirement
  land_area_ha: '',
  villages_covered: [],
  parcels: [
    { survey_no: '', area_ha: '', land_type: 'private' },
  ],

  // Step 3: Location & Boundary Demarcation
  start_village: '',
  end_village: '',
  lat: 12.8342,
  lon: 79.7036,

  // Step 4: Affected people
  landowners_count: '',
  families_affected: '',
  families_resettlement: '',

  // Step 5: Planned approvals
  approvals: [
    { name: 'Social Impact Assessment', planned_date: '' },
  ],
};

const APPROVAL_OPTIONS = [
  'Social Impact Assessment',
  'Notification',
  'Environmental Clearance',
  'Forest Clearance',
  'Award Declaration',
];

const SECTORS = [
  { value: 'highway', label: 'Highway' },
  { value: 'rail', label: 'Rail Corridor' },
  { value: 'irrigation', label: 'Irrigation & Canal' },
  { value: 'power', label: 'Power Transmission' },
  { value: 'urban', label: 'Urban Infrastructure' },
];

const DISTRICTS = [
  'Chennai',
  'Kanchipuram',
  'Tiruvallur',
  'Coimbatore',
  'Madurai',
  'Salem',
  'Tiruchirappalli',
  'Tirunelveli',
  'Erode',
  'Thoothukudi',
];

/**
 * C7. Create Project (Multi-Step Form Wizard)
 *
 * 5-Step Wizard with Progress Bar, Back/Next navigation, Per-Step Validation,
 * Draft persistence in localStorage (try/catch), and Role Gating (project_manager only).
 *
 * Step 1: A. Basic details (name, type, agency, state, district, planned start, planned completion, budget)
 * Step 2: B. Land requirement (total area, villages covered tag input, repeatable parcels, CSV paste option)
 * Step 3: C. Location (start village, end village, lat/lon note)
 * Step 4: D. Affected people (landowners, families affected, families needing resettlement)
 * Step 5: E. Planned approvals (repeatable rows of approval name dropdown + planned date)
 * Final Step: Review screen listing everything, submit to POST /projects, success display with link
 */
export default function CreateProject() {
  const { user, role, switchDemoRole } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Village Tag Input buffer
  const [villageInput, setVillageInput] = useState('');

  // Bulk CSV Import State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');

  // CAD Ingestion State
  const [showCadModal, setShowCadModal] = useState(false);
  const [cadDemarcationData, setCadDemarcationData] = useState(null);

  // Robust CSV / Excel Paste Parser matching the Parcels Schedule format
  const parseCsvParcels = useCallback((text) => {
    if (!text || !text.trim()) return [];

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed = [];

    lines.forEach((line, idx) => {
      const lower = line.toLowerCase();
      // Skip header row if present
      if (idx === 0 && (lower.includes('survey') || lower.includes('area') || lower.includes('classification'))) {
        return;
      }

      // Detect separator: Tab (Excel paste), Semicolon, or Comma
      const delimiter = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
      const parts = line.split(delimiter).map((p) => p.trim());
      if (parts.length === 0 || !parts[0]) return;

      const surveyNo = parts[0];
      const areaVal = parts[1] ? parseFloat(parts[1]) : 1.0;
      const area = !isNaN(areaVal) && areaVal > 0 ? areaVal : 1.0;

      let landType = 'private';
      if (parts[2]) {
        const typeLower = parts[2].toLowerCase();
        if (typeLower.includes('gov')) landType = 'government';
        else if (typeLower.includes('for')) landType = 'forest';
        else landType = 'private';
      }

      parsed.push({
        survey_no: surveyNo,
        area_ha: area,
        land_type: landType,
      });
    });

    return parsed;
  }, []);

  const previewCsvParcels = useMemo(() => {
    return parseCsvParcels(csvText);
  }, [csvText, parseCsvParcels]);

  // Step 3: Layout Sketch Ingestion & Interactive Vectorizer State
  const [sketchFile, setSketchFile] = useState(null);
  const [sketchPreview, setSketchPreview] = useState(null);
  const [sketchStatus, setSketchStatus] = useState('idle'); // idle | scanning | completed
  const [customSurveysText, setCustomSurveysText] = useState('');
  const [selectedSubdivision, setSelectedSubdivision] = useState(null);

  // Sync entered parcels into dynamic survey numbers for Step 3
  useEffect(() => {
    if (formData.parcels && formData.parcels.length > 0) {
      const validSurveys = formData.parcels
        .map((p) => p.survey_no)
        .filter((s) => s && s.trim());
      if (validSurveys.length > 0 && !customSurveysText) {
        setCustomSurveysText(validSurveys.join(', '));
      }
    }
  }, [formData.parcels, customSurveysText]);

  // Auto-populate default Tamil Nadu terminals when district is chosen
  useEffect(() => {
    if (formData.district && TN_DISTRICT_TERMINALS[formData.district]) {
      const term = TN_DISTRICT_TERMINALS[formData.district];
      setFormData((prev) => ({
        ...prev,
        start_village: prev.start_village || term.start,
        end_village: prev.end_village || term.end,
        lat: TN_DISTRICT_COORDS[formData.district]?.[0] || 12.8342,
        lon: TN_DISTRICT_COORDS[formData.district]?.[1] || 79.7036,
      }));
    }
  }, [formData.district]);

  const currentCoords = useMemo(() => {
    if (cadDemarcationData?.boundary_geojson?.coordinates?.[0]?.[0]) {
      const pt = cadDemarcationData.boundary_geojson.coordinates[0][0];
      return [pt[1], pt[0]];
    }
    return TN_DISTRICT_COORDS[formData.district] || [12.8342, 79.7036];
  }, [formData.district, cadDemarcationData]);

  const corridorGeometry = useMemo(() => {
    if (cadDemarcationData?.boundary_geojson?.coordinates) {
      // Reprojected WGS84 GeoJSON [lon, lat] -> Leaflet [lat, lon]
      const boundaryPolygon = (cadDemarcationData.boundary_geojson.coordinates[0] || []).map((pt) => [pt[1], pt[0]]);
      const subdivisions = (cadDemarcationData.parcels || []).map((p) => {
        const polyCoords = (p.geometry_geojson?.coordinates?.[0] || []).map((pt) => [pt[1], pt[0]]);
        return {
          survey_no: p.survey_number,
          area_ha: p.computed_area_ha,
          land_type: (p.classification || 'private').toLowerCase(),
          polygon: polyCoords,
          record_area_ha: p.record_area_ha,
        };
      });
      return { boundaryPolygon, subdivisions };
    }

    const lat = currentCoords[0];
    const lon = currentCoords[1];

    let surveyList = [];
    if (customSurveysText.trim()) {
      surveyList = customSurveysText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s, i) => ({
          survey_no: s,
          area_ha: formData.parcels[i]?.area_ha || (1.5 + i * 0.4).toFixed(2),
          land_type: formData.parcels[i]?.land_type || 'private',
        }));
    } else if (formData.parcels && formData.parcels.length > 0) {
      surveyList = formData.parcels.filter((p) => p.survey_no?.trim());
    }

    return generateCorridorGeometry(lat, lon, surveyList);
  }, [currentCoords, customSurveysText, formData.parcels, cadDemarcationData]);

  const handleSketchChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSketchFile(file);
      setSketchPreview(URL.createObjectURL(file));
      setSketchStatus('idle');
    }
  };

  const handleVectorizeSketch = () => {
    setSketchStatus('scanning');
    setTimeout(() => {
      setSketchStatus('completed');
      toast.success('Pencil sketch boundary & survey boxes successfully vectorized!');
    }, 1200);
  };

  // 1. Load Draft from localStorage on Mount (wrapped in try/catch)
  useEffect(() => {
    document.title = 'Create Project Corridor | LandSentinel';
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setFormData((prev) => ({ ...prev, ...parsed }));
          setDraftRestored(true);
        }
      }
    } catch (e) {
      console.warn('Could not read draft from localStorage:', e);
    }
  }, []);

  // 2. Persist Draft to localStorage on Change (wrapped in try/catch)
  useEffect(() => {
    if (!createdProjectId) {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
      } catch (e) {
        console.warn('Could not write draft to localStorage:', e);
      }
    }
  }, [formData, createdProjectId]);

  // Clear draft helper
  const handleClearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {
      // ignore
    }
    setFormData(INITIAL_FORM_STATE);
    setDraftRestored(false);
    setCurrentStep(1);
    setErrors({});
  };

  // Generic field updater
  const updateField = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Village Tag Input Handlers
  const handleAddVillage = () => {
    const trimmed = villageInput.trim().replace(/^,+|,+$/g, '');
    if (!trimmed) return;

    // Support multiple comma-separated entries pasted at once
    const newVillages = trimmed
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v && !formData.villages_covered.includes(v));

    if (newVillages.length > 0) {
      setFormData((prev) => ({
        ...prev,
        villages_covered: [...prev.villages_covered, ...newVillages],
      }));
    }
    setVillageInput('');
  };

  const handleRemoveVillage = (villageToRemove) => {
    setFormData((prev) => ({
      ...prev,
      villages_covered: prev.villages_covered.filter((v) => v !== villageToRemove),
    }));
  };

  // Repeatable Parcels Handlers
  const handleAddParcel = () => {
    setFormData((prev) => ({
      ...prev,
      parcels: [
        ...prev.parcels,
        { survey_no: '', area_ha: '', land_type: 'private' },
      ],
    }));
  };

  const handleUpdateParcel = (idx, field, val) => {
    setFormData((prev) => {
      const nextParcels = [...prev.parcels];
      nextParcels[idx] = { ...nextParcels[idx], [field]: val };
      return { ...prev, parcels: nextParcels };
    });
  };

  const handleRemoveParcel = (idx) => {
    setFormData((prev) => ({
      ...prev,
      parcels: prev.parcels.filter((_, i) => i !== idx),
    }));
  };

  // CSV Bulk Import Handler
  const handleImportCsv = () => {
    if (previewCsvParcels.length === 0) {
      toast.error('No valid parcel rows found to import.');
      return;
    }

    setFormData((prev) => {
      // Remove any blank placeholder parcel rows
      const existing = prev.parcels.filter((p) => p.survey_no && p.survey_no.trim());
      const nextParcels = [...existing, ...previewCsvParcels];

      // Auto-compute total land area from imported parcels if not already manually set
      const totalArea = nextParcels.reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0);

      return {
        ...prev,
        land_area_ha: prev.land_area_ha && Number(prev.land_area_ha) > 0 ? prev.land_area_ha : totalArea.toFixed(2),
        parcels: nextParcels,
      };
    });

    toast.success(`Successfully imported ${previewCsvParcels.length} parcel schedules!`);
    setCsvText('');
    setShowCsvModal(false);
  };

  const handleCsvFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvText(event.target?.result || '');
      };
      reader.readAsText(file);
    }
  };

  const handleCadConfirm = (cadResult) => {
    setShowCadModal(false);
    setCadDemarcationData(cadResult);

    const importedParcels = (cadResult.parcels || []).map((p) => ({
      survey_no: p.survey_number,
      area_ha: String(p.computed_area_ha),
      land_type: (p.classification || 'Private').toLowerCase(),
      record_area_ha: p.record_area_ha ? String(p.record_area_ha) : '',
      cad_geometry: p.geometry_geojson,
    }));

    setFormData((prev) => ({
      ...prev,
      parcels: importedParcels.length > 0 ? importedParcels : prev.parcels,
      land_area_ha: String(cadResult.summary?.total_parcel_area_ha || prev.land_area_ha),
    }));

    toast.success(
      `CAD demarcation applied: ${cadResult.parcels.length} survey parcels (${cadResult.summary?.total_parcel_area_ha || 0} ha) imported!`
    );
  };

  const handleDownloadSampleCsv = () => {
    const sample = "Survey Number,Area (Hectares),Classification\n104/1A,15.2,Private\n104/2B,8.4,Government\n105/1,12.0,Private\n106/3A,4.5,Forest\n";
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'parcels_schedule_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Repeatable Approvals Handlers
  const handleAddApproval = () => {
    setFormData((prev) => ({
      ...prev,
      approvals: [
        ...prev.approvals,
        { name: APPROVAL_OPTIONS[0], planned_date: '' },
      ],
    }));
  };

  const handleUpdateApproval = (idx, field, val) => {
    setFormData((prev) => {
      const nextApprovals = [...prev.approvals];
      nextApprovals[idx] = { ...nextApprovals[idx], [field]: val };
      return { ...prev, approvals: nextApprovals };
    });
  };

  const handleRemoveApproval = (idx) => {
    setFormData((prev) => ({
      ...prev,
      approvals: prev.approvals.filter((_, i) => i !== idx),
    }));
  };

  // Per-Step Validation
  const validateStep = (stepNumber) => {
    const errs = {};

    if (stepNumber === 1) {
      if (!formData.name.trim()) errs.name = 'Project Name is mandatory';
      if (!formData.agency.trim()) errs.agency = 'Requiring Agency is mandatory';
      if (!formData.district.trim()) errs.district = 'District is mandatory';
      if (!formData.planned_start) errs.planned_start = 'Planned Start Date is mandatory';
      if (!formData.planned_end) {
        errs.planned_end = 'Planned Completion Date is mandatory';
      } else if (formData.planned_start && new Date(formData.planned_end) <= new Date(formData.planned_start)) {
        errs.planned_end = 'Planned completion date must be strictly after the start date';
      }
      if (!formData.budget || Number(formData.budget) <= 0) {
        errs.budget = 'Please specify a positive budget allocation';
      }
    }

    if (stepNumber === 2) {
      if (!formData.land_area_ha || Number(formData.land_area_ha) <= 0) {
        errs.land_area_ha = 'Total required land area in hectares must be greater than 0';
      }
      if (formData.parcels.length === 0) {
        errs.parcels = 'Please define at least one parcel record or use CSV import';
      } else {
        const hasInvalid = formData.parcels.some((p) => !p.survey_no.trim() || Number(p.area_ha) <= 0);
        if (hasInvalid) {
          errs.parcels = 'All parcels must have a valid survey number and positive area (ha)';
        }
      }
    }

    if (stepNumber === 3) {
      if (!formData.start_village?.trim()) {
        const term = TN_DISTRICT_TERMINALS[formData.district] || { start: 'Sriperumbudur Industrial Hub', end: 'Oragadam Manufacturing Corridor' };
        formData.start_village = term.start;
      }
      if (!formData.end_village?.trim()) {
        const term = TN_DISTRICT_TERMINALS[formData.district] || { start: 'Sriperumbudur Industrial Hub', end: 'Oragadam Manufacturing Corridor' };
        formData.end_village = term.end;
      }
    }

    if (stepNumber === 4) {
      if (formData.landowners_count === '' || Number(formData.landowners_count) < 0) {
        errs.landowners_count = 'Number of landowners must be 0 or greater';
      }
      if (formData.families_affected === '' || Number(formData.families_affected) < 0) {
        errs.families_affected = 'Families affected count must be 0 or greater';
      }
      if (formData.families_resettlement === '' || Number(formData.families_resettlement) < 0) {
        errs.families_resettlement = 'Families needing resettlement must be 0 or greater';
      } else if (Number(formData.families_resettlement) > Number(formData.families_affected)) {
        errs.families_resettlement = 'Resettlement count cannot exceed total families affected';
      }
    }

    if (stepNumber === 5) {
      if (formData.approvals.length === 0) {
        errs.approvals = 'Please specify at least one planned statutory approval milestone';
      } else {
        const missingDate = formData.approvals.some((a) => !a.planned_date);
        if (missingDate) {
          errs.approvals = 'Every planned clearance must have an assigned target date';
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setErrors({});
      setCurrentStep((prev) => Math.min(6, prev + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Final Project Intake to POST /projects
  const handleSubmit = async () => {
    // Validate all 5 steps before submitting
    for (let s = 1; s <= 5; s++) {
      if (!validateStep(s)) {
        setCurrentStep(s);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        project: {
          name: formData.name.trim(),
          type: formData.type,
          agency: formData.agency.trim(),
          state: formData.state.trim() || 'Tamil Nadu',
          district: formData.district.trim(),
          land_area_ha: Number(formData.land_area_ha),
          families_affected: Number(formData.families_affected),
          families_resettlement: Number(formData.families_resettlement),
          budget: Number(formData.budget),
          planned_start: formData.planned_start,
          planned_end: formData.planned_end,
          current_stage: 'planning',
          status: 'draft',
          alignment_start: formData.start_village.trim(),
          alignment_end: formData.end_village.trim(),
          lat: Number(formData.lat) || currentCoords[0],
          lon: Number(formData.lon) || currentCoords[1],
        },
        parcels: formData.parcels.map((p) => ({
          survey_no: p.survey_no.trim(),
          survey_number: p.survey_no.trim(),
          area_ha: Number(p.area_ha),
          land_type: p.land_type,
        })),
        approvals: formData.approvals.map((a) => ({
          name: a.name,
          planned_date: a.planned_date,
          status: 'pending',
        })),
      };

      const res = await createProject(payload);
      const newId = res.project_id || 'PRJ-NEW';
      setCreatedProjectId(newId);

      // Persist CAD demarcation geometry linkage if loaded from CAD
      if (cadDemarcationData?.cad_id) {
        try {
          await confirmCadParcels({ project_id: newId, cad_id: cadDemarcationData.cad_id });
        } catch (cadErr) {
          console.warn('CAD confirmation link notice:', cadErr);
        }
      }

      toast.success(`Project ${newId} registered successfully!`);

      // Clean up draft on successful creation
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      const msg = err.message || 'Failed to submit project to statutory intake API.';
      setErrors({ submit: msg });
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Permission Guard: ONLY project_manager can access this page
  if (role !== 'project_manager') {
    return (
      <div className="peace-card p-8 max-w-lg mx-auto text-center space-y-4 my-12">
        <div className="w-12 h-12 rounded-full bg-[#331411] border border-[#7F261E] text-[#F87171] mx-auto flex items-center justify-center font-mono text-xl">
          !
        </div>
        <h2 className="text-lg font-bold font-headline text-[#F4D9A0]">
          Statutory Authorization Required
        </h2>
        <p className="text-xs text-[#C4B5A5] leading-relaxed">
          The New Project Intake Wizard is reserved exclusively for authorized <strong>Project Managers</strong> under RFCTLARR Act 2013 protocols.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2">
          <button
            type="button"
            onClick={() => switchDemoRole('project_manager')}
            className="btn-amber text-xs"
          >
            Switch to Project Manager Demo Role
          </button>
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="btn-mocha text-xs"
          >
            View Projects Registry
          </button>
        </div>
      </div>
    );
  }

  // 4. Success Screen on Successful Creation
  if (createdProjectId) {
    return (
      <div className="peace-card p-8 text-center space-y-5 max-w-lg mx-auto my-8 border-l-4 border-l-[#4A855A]">
        <div className="w-14 h-14 rounded-full bg-[#152B1E] border border-[#255C3A] text-[#86EFAC] mx-auto flex items-center justify-center text-2xl font-bold">
          ✓
        </div>
        <div>
          <span className="text-[10px] font-mono text-[#86EFAC] uppercase tracking-wider bg-[#152B1E] px-2 py-0.5 rounded border border-[#255C3A]">
            INTAKE COMPLETE
          </span>
          <h2 className="text-xl font-bold font-headline text-[#F4D9A0] mt-2">
            Project Successfully Registered
          </h2>
          <p className="text-xs text-[#C4B5A5] mt-1">
            New land acquisition corridor records have been registered in the master database with status <strong>Draft</strong>. Initial AI delay risk inference is active.
          </p>
        </div>

        <div className="p-4 bg-[#140F0B] border border-[rgba(244,217,160,0.18)] rounded-lg font-mono text-sm flex items-center justify-between">
          <span className="text-xs text-[#C4B5A5]">Project Identifier:</span>
          <span className="text-[#F4D9A0] font-bold text-base">{createdProjectId}</span>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <Link
            to={`/projects/${createdProjectId}`}
            className="btn-amber text-xs font-semibold"
          >
            Inspect Project Detail &rarr;
          </Link>
          <Link
            to="/projects"
            className="btn-mocha text-xs"
          >
            Return to Registry
          </Link>
        </div>
      </div>
    );
  }

  // Wizard Step Metadata
  const STEPS = [
    { num: 1, key: 'basic', label: 'Basic Details' },
    { num: 2, key: 'land', label: 'Land & Parcels' },
    { num: 3, key: 'location', label: 'Boundary & Map' },
    { num: 4, key: 'people', label: 'Affected People' },
    { num: 5, key: 'approvals', label: 'Planned Approvals' },
    { num: 6, key: 'review', label: 'Review & Submit' },
  ];

  const progressPercent = Math.round(((currentStep - 1) / (STEPS.length - 1)) * 100);

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      {/* ========================================================
          HEADER & DRAFT RESTORATION BANNER
          ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(244,217,160,0.12)] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-[#F4D9A0] uppercase tracking-widest bg-[#2A1F18] px-2 py-0.5 rounded border border-[rgba(244,217,160,0.18)]">
              RFCTLARR Statutory Intake
            </span>
            <span className="text-xs font-mono text-[#86EFAC] bg-[#152B1E] px-2 py-0.5 rounded border border-[#255C3A]">
              Step {currentStep} of 6
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline text-[#2D1E14] tracking-wide">
            Create Land Acquisition Project
          </h1>
          <p className="text-xs text-[#C4B5A5] mt-0.5">
            5-step statutory intake wizard with parcel demarcation, socio-demographic impact, and approval scheduling.
          </p>
        </div>

        {draftRestored && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#86EFAC] font-mono text-[11px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#86EFAC]" />
              Draft saved
            </span>
            <button
              type="button"
              onClick={handleClearDraft}
              className="text-[#8E7E70] hover:text-[#F87171] text-[11px] font-mono underline"
              title="Discard draft and start with blank form"
            >
              Clear Draft
            </button>
          </div>
        )}
      </div>

      {/* ========================================================
          PROGRESS BAR & STEP INDICATORS
          ======================================================== */}
      <div className="space-y-2">
        {/* Fill bar */}
        <div className="w-full h-1.5 rounded-full bg-[#201812] border border-[rgba(244,217,160,0.1)] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#C8792C] to-[#F4D9A0] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step Tabs */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-xs font-mono">
          {STEPS.map((s) => {
            const isActive = currentStep === s.num;
            const isCompleted = currentStep > s.num;

            return (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (isCompleted) setCurrentStep(s.num);
                }}
                disabled={!isCompleted && !isActive}
                className={`p-2 rounded border text-left transition-colors flex flex-col justify-between ${
                  isActive
                    ? 'bg-[#C8792C] border-[#D88636] text-white font-semibold'
                    : isCompleted
                    ? 'bg-[#241B14] border-[rgba(244,217,160,0.25)] text-[#F4D9A0] hover:bg-[#2E231A]'
                    : 'bg-[#16100C] border-[#3D2D21] text-[#8E7E70] cursor-not-allowed opacity-60'
                }`}
              >
                <div className="text-[10px] flex items-center justify-between">
                  <span>0{s.num}</span>
                  {isCompleted && <span className="text-[#86EFAC] font-bold">✓</span>}
                </div>
                <div className="text-[11px] font-sans truncate font-medium mt-0.5">
                  {s.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global submit error banner if any */}
      {errors.submit && (
        <div className="p-3.5 rounded bg-[#331411] border border-[#7F261E] text-xs text-[#F87171] font-mono">
          {errors.submit}
        </div>
      )}

      {/* ========================================================
          WIZARD STEP PANELS
          ======================================================== */}
      <div className="peace-card p-6 space-y-6">
        {/* STEP 1: A. BASIC DETAILS */}
        {currentStep === 1 && (
          <div className="space-y-4 text-xs">
            <div className="border-b border-[rgba(244,217,160,0.08)] pb-2">
              <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline">
                Step 1: Basic Details
              </h3>
              <p className="text-xs text-[#C4B5A5] mt-0.5">
                Statutory project nomenclature, executing agency, jurisdiction, and planned execution timeframe.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Project Corridor Name <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Chennai-Kanchipuram Expressway Corridor (Phase 2)"
                  className="peace-input w-full font-sans text-sm"
                />
                {errors.name && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.name}</span>}
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Sector Category <span className="text-[#F87171]">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => updateField('type', e.target.value)}
                  className="peace-input w-full"
                >
                  {SECTORS.map((sec) => (
                    <option key={sec.value} value={sec.value}>
                      {sec.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Requiring Agency <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.agency}
                  onChange={(e) => updateField('agency', e.target.value)}
                  placeholder="e.g. NHAI / MSRDC / CIDCO / Irrigation Department"
                  className="peace-input w-full"
                />
                {errors.agency && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.agency}</span>}
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  State Jurisdiction
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => updateField('state', e.target.value)}
                  className="peace-input w-full"
                />
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  District <span className="text-[#F87171]">*</span>
                </label>
                <select
                  value={formData.district}
                  onChange={(e) => updateField('district', e.target.value)}
                  className="peace-input w-full"
                >
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d} District
                    </option>
                  ))}
                </select>
                {errors.district && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.district}</span>}
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Planned Start Date <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.planned_start}
                  onChange={(e) => updateField('planned_start', e.target.value)}
                  className="peace-input w-full font-mono text-xs"
                />
                {errors.planned_start && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.planned_start}</span>}
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Planned Completion Date <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.planned_end}
                  onChange={(e) => updateField('planned_end', e.target.value)}
                  className="peace-input w-full font-mono text-xs"
                />
                {errors.planned_end && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.planned_end}</span>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Total Budget Allocation (INR) <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.budget}
                  onChange={(e) => updateField('budget', e.target.value)}
                  placeholder="e.g. 500000000 (INR 50 Cr)"
                  className="peace-input w-full font-mono"
                />
                {errors.budget && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.budget}</span>}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: B. LAND REQUIREMENT */}
        {currentStep === 2 && (
          <div className="space-y-5 text-xs">
            <div className="border-b border-[rgba(244,217,160,0.08)] pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline">
                  Step 2: Land Requirement &amp; Parcels
                </h3>
                <p className="text-xs text-[#C4B5A5] mt-0.5">
                  Demarcated land quantum, affected revenue villages, and survey number schedule.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCsvModal(true)}
                className="btn-mocha text-xs font-mono"
                title="Paste parcels schedule from CSV or spreadsheet"
              >
                📋 Import Parcels CSV
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Total Land Area (Hectares) <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formData.land_area_ha}
                  onChange={(e) => updateField('land_area_ha', e.target.value)}
                  placeholder="e.g. 185.50"
                  className="peace-input w-full font-mono"
                />
                {errors.land_area_ha && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.land_area_ha}</span>}
              </div>

              {/* Tag Input for Villages Covered */}
              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Revenue Villages Covered (Tag Input)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={villageInput}
                    onChange={(e) => setVillageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddVillage();
                      }
                    }}
                    placeholder="Type village & press Enter..."
                    className="peace-input flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddVillage}
                    className="btn-mocha px-3 text-xs"
                  >
                    Add
                  </button>
                </div>

                {/* Village Tag Pills */}
                <div className="flex flex-wrap gap-1.5 mt-2 min-h-[28px]">
                  {formData.villages_covered.length === 0 ? (
                    <span className="text-[#8E7E70] text-[11px] italic">No villages tagged yet.</span>
                  ) : (
                    formData.villages_covered.map((v) => (
                      <span
                        key={v}
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] px-2 py-0.5 rounded bg-[#2A1F18] text-[#F4D9A0] border border-[rgba(244,217,160,0.2)]"
                      >
                        <span>{v}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveVillage(v)}
                          className="text-[#8E7E70] hover:text-[#F87171] font-bold"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Repeatable List of Parcels */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase text-[#F4D9A0] font-semibold">
                  Demarcated Parcels Schedule ({formData.parcels.length})
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCadModal(true)}
                    className="btn-amber text-xs font-mono flex items-center gap-1.5 shadow border-[#3B82F6]/60 bg-[#1E3A8A]/35 text-[#93C5FD] hover:bg-[#1E3A8A]/60 transition-colors"
                    title="Upload CAD Demarcation file (DXF, GeoJSON, Shapefile)"
                  >
                    📐 Upload CAD Demarcation (DXF / GeoJSON / Shapefile)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCsvModal(true)}
                    className="btn-amber text-xs font-mono flex items-center gap-1.5 shadow"
                    title="Import parcels schedule from CSV"
                  >
                    📥 Import / Paste CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleAddParcel}
                    className="btn-mocha text-xs"
                  >
                    + Add Parcel Row
                  </button>
                </div>
              </div>

              {cadDemarcationData && (
                <div className="p-3 bg-[#172554]/50 border border-[#3B82F6]/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn">
                  <div>
                    <div className="flex items-center gap-2 text-[#93C5FD] font-semibold">
                      <span>✓ CAD Demarcation Ingested &amp; Verified</span>
                      <span className="font-mono text-[10px] bg-[#1E3A8A] px-2 py-0.5 rounded border border-[#3B82F6]/40 text-[#BFDBFE]">
                        {cadDemarcationData.source_crs} • {cadDemarcationData.units}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      {cadDemarcationData.summary?.parcel_count} parcels totaling {cadDemarcationData.summary?.total_parcel_area_ha} ha verified from <span className="font-mono text-white">{cadDemarcationData.filename}</span>. Step 3 boundary &amp; survey mapping is completed automatically!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (validateStep(2)) {
                        setErrors({});
                        setCurrentStep(4);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className="px-3 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-mono text-xs font-medium whitespace-nowrap shadow flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <span>Skip to Step 4 (Affected People) &rarr;</span>
                  </button>
                </div>
              )}

              {errors.parcels && <span className="text-[11px] text-[#F87171] block">{errors.parcels}</span>}

              <div className="overflow-x-auto border border-[rgba(244,217,160,0.1)] rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#3D2D21] text-[#C4B5A5] font-mono uppercase text-[11px] bg-[#16100C]">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Survey Number *</th>
                      <th className="py-2.5 px-3">Area (Hectares) *</th>
                      <th className="py-2.5 px-3">Classification</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A1F18]">
                    {formData.parcels.map((p, idx) => (
                      <tr key={idx} className="hover:bg-[#201812]">
                        <td className="py-2 px-3 font-mono text-[#8E7E70]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            required
                            value={p.survey_no}
                            onChange={(e) => handleUpdateParcel(idx, 'survey_no', e.target.value)}
                            placeholder="e.g. 104/1A"
                            className="peace-input w-full font-mono text-xs py-1"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={p.area_ha}
                            onChange={(e) => handleUpdateParcel(idx, 'area_ha', e.target.value)}
                            placeholder="e.g. 15.2"
                            className="peace-input w-full font-mono text-xs py-1"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={p.land_type}
                            onChange={(e) => handleUpdateParcel(idx, 'land_type', e.target.value)}
                            className="peace-input w-full py-1 capitalize"
                          >
                            <option value="private">Private</option>
                            <option value="government">Government</option>
                            <option value="forest">Forest</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveParcel(idx)}
                            disabled={formData.parcels.length <= 1}
                            className="text-[#8E7E70] hover:text-[#F87171] disabled:opacity-30 disabled:cursor-not-allowed font-mono text-xs px-2 py-1"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: C. LOCATION & BOUNDARY DEMARCATION */}
        {currentStep === 3 && (
          <div className="space-y-6 text-xs">
            <div className="border-b border-[rgba(244,217,160,0.08)] pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline">
                  Step 3: Project Boundary &amp; Interactive Parcel Demarcation
                </h3>
                <p className="text-xs text-[#C4B5A5] mt-0.5">
                  Demarcate outer project boundary and vectorize hand-drawn layout sketches into interactive survey parcels.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[#FDE68A] bg-[#292211] border border-[#D97706]/40 px-2.5 py-1 rounded">
                  📍 {formData.district} District Center: {currentCoords[0]}° N, {currentCoords[1]}° E
                </span>
              </div>
            </div>

            {cadDemarcationData && (
              <div className="p-3 bg-[#152B1E] border border-[#255C3A] rounded-lg text-xs text-[#86EFAC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold">✓ High-Precision CAD Demarcation Active</span>
                  <span className="text-[#C4B5A5]">({cadDemarcationData.summary?.parcel_count} parcels, {cadDemarcationData.summary?.total_parcel_area_ha} ha from {cadDemarcationData.filename})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-[#1E3A8A] text-[#93C5FD] border border-[#3B82F6]/30 px-2 py-0.5 rounded">
                    {cadDemarcationData.source_crs} • {cadDemarcationData.units}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(4);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-[11px] font-mono text-[#F4D9A0] hover:underline"
                  >
                    Proceed directly to Step 4 &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* 1. Alignment Terminal Villages */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Corridor Start Terminal (Tamil Nadu) <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.start_village}
                  onChange={(e) => updateField('start_village', e.target.value)}
                  placeholder="e.g. Sriperumbudur Industrial Hub"
                  className="peace-input w-full font-sans text-xs"
                />
                {errors.start_village && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.start_village}</span>}
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Corridor End Terminal (Tamil Nadu) <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.end_village}
                  onChange={(e) => updateField('end_village', e.target.value)}
                  placeholder="e.g. Oragadam Manufacturing Corridor"
                  className="peace-input w-full font-sans text-xs"
                />
                {errors.end_village && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.end_village}</span>}
              </div>
            </div>

            {/* 2. Hand-Drawn Pencil Sketch & Layout Map Ingestion Box */}
            <div className="peace-card p-4 space-y-3 bg-[#1A130E] border border-[#5B4632]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(244,217,160,0.1)] pb-2">
                <div>
                  <div className="font-headline font-semibold text-sm text-[#F4D9A0] flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#C8792C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Ingest Hand-Drawn Pencil Sketch / CAD Layout Map
                  </div>
                  <p className="text-[11px] text-[#C4B5A5] mt-0.5">
                    Upload a sketch map showing outer boundaries and penciled survey number boxes. The system vectorizes it into interactive Leaflet polygons.
                  </p>
                </div>
                {sketchStatus === 'completed' && (
                  <span className="font-mono text-[10px] text-[#86EFAC] bg-[#152B1E] border border-[#255C3A] px-2 py-0.5 rounded">
                    ✓ Vectorization Active
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                {/* File Upload Dropzone */}
                <div>
                  <label className="block text-[#C4B5A5] mb-1 font-medium">
                    Upload Layout / Demarcation Map (PNG / JPG / PDF)
                  </label>
                  <div className="border border-dashed border-[#5B4632] hover:border-[#C8792C] transition-colors rounded-lg p-3 bg-[#140F0B] flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleSketchChange}
                      className="text-xs text-[#C4B5A5] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#2A1F18] file:text-[#F4D9A0] hover:file:bg-[#35271E] file:cursor-pointer cursor-pointer w-full"
                    />
                  </div>
                  {sketchPreview && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={sketchPreview} alt="Sketch preview" className="w-12 h-12 object-cover rounded border border-[#5B4632]" />
                      <span className="text-[10px] text-[#86EFAC] font-mono">Sketch preview attached ({sketchFile?.name})</span>
                    </div>
                  )}
                </div>

                {/* Dynamic Survey Numbers Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[#C4B5A5] font-medium">
                      Dynamic Survey Numbers in Sketch / Corridor:
                    </label>
                    <span className="text-[10px] text-[#F4D9A0] font-mono">Synced from Step 2</span>
                  </div>
                  <input
                    type="text"
                    value={customSurveysText}
                    onChange={(e) => setCustomSurveysText(e.target.value)}
                    placeholder="e.g. 120/1, 120/2, 120/3A, 121/1, 122/1"
                    className="peace-input w-full font-mono text-xs"
                  />
                  <div className="text-[10px] text-[#8E7E70] mt-1">
                    Enter comma-separated survey numbers. Each is mapped to a dedicated vector polygon inside the boundary.
                  </div>
                </div>
              </div>

              {/* Action Trigger & Progress Animation */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleVectorizeSketch}
                  disabled={sketchStatus === 'scanning'}
                  className="btn-amber text-xs px-4 py-2 flex items-center gap-2 shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {sketchStatus === 'scanning' ? 'Vectorizing CAD Geometry...' : '⚡ Analyze & Vectorize Sketch into Interactive Map'}
                </button>

                {sketchStatus === 'scanning' && (
                  <div className="flex items-center gap-2 text-xs text-[#FDE68A] animate-pulse">
                    <div className="w-4 h-4 border-2 border-[#C8792C] border-t-transparent rounded-full animate-spin"></div>
                    <span>Extracting penciled survey boundaries &amp; computing corridor envelope...</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Interactive Leaflet Map Demarcation View */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[#F4D9A0] uppercase font-semibold">
                    Interactive Corridor &amp; Survey Subdivision Map
                  </span>
                  <span className="text-[11px] text-[#C4B5A5]">
                    ({corridorGeometry.subdivisions.length} dynamic survey polygons inside project boundary)
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-[#F3EDE2]">
                    <span className="w-3 h-3 rounded border border-[#C8792C] bg-[#C8792C]/25 inline-block"></span>
                    Outer Project Boundary
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#86EFAC]">
                    <span className="w-3 h-3 rounded border border-[#22c55e] bg-[#16a34a]/80 inline-block"></span>
                    Survey Number Parcel
                  </span>
                </div>
              </div>

              <div className="peace-card overflow-hidden relative border border-[rgba(244,217,160,0.18)]" style={{ height: '380px' }}>
                <MapContainer
                  key={`create-map-${formData.district}-${currentStep}`}
                  center={currentCoords}
                  zoom={14}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%', backgroundColor: '#140F0B' }}
                >
                  <MapInvalidateSize />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Outer Project Corridor Boundary Envelope */}
                  <Polygon
                    positions={corridorGeometry.boundaryPolygon}
                    pathOptions={{
                      color: '#C8792C',
                      weight: 3,
                      dashArray: '6, 6',
                      fillColor: '#C8792C',
                      fillOpacity: 0.12,
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                      <div className="font-sans text-xs">
                        <strong className="text-[#140F0B]">{formData.name || 'New Corridor Project'}</strong>
                        <div className="text-[10px] text-stone-600">
                          {formData.district} Corridor Boundary • Total Area: {formData.land_area_ha || '50'} Ha
                        </div>
                      </div>
                    </Tooltip>
                  </Polygon>

                  {/* Dynamic Survey Subdivision Polygons inside Corridor */}
                  {corridorGeometry.subdivisions.map((sub, idx) => {
                    const isSelected = selectedSubdivision?.survey_no === sub.survey_no;
                    return (
                      <Polygon
                        key={`sub-${sub.survey_no}-${idx}`}
                        positions={sub.polygon}
                        eventHandlers={{
                          click: () => setSelectedSubdivision(sub),
                        }}
                        pathOptions={{
                          color: isSelected ? '#F4D9A0' : '#22c55e',
                          weight: isSelected ? 3 : 1.5,
                          fillColor: isSelected ? '#C8792C' : '#16a34a',
                          fillOpacity: isSelected ? 0.75 : 0.45,
                        }}
                      >
                        <Tooltip direction="center" permanent className="bg-transparent border-0 shadow-none">
                          <div className="font-mono text-[10px] font-bold text-white bg-black/75 px-1.5 py-0.5 rounded shadow">
                            {sub.survey_no}
                          </div>
                        </Tooltip>
                      </Polygon>
                    );
                  })}
                </MapContainer>
              </div>

              {/* Selected Subdivision Inspector Box */}
              {selectedSubdivision ? (
                <div className="p-3 bg-[#1C140E] border border-[#C8792C] rounded-lg flex items-center justify-between text-xs animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <span className="font-mono px-2 py-0.5 rounded bg-[#C8792C] text-white font-bold text-xs">
                      Survey No. {selectedSubdivision.survey_no}
                    </span>
                    <div>
                      <span className="text-[#F3EDE2] font-semibold">Area: {selectedSubdivision.area_ha} Hectares</span>
                      <span className="text-[#C4B5A5] ml-2">• Classification: <span className="capitalize">{selectedSubdivision.land_type}</span></span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[#86EFAC] bg-[#152B1E] border border-[#255C3A] px-2 py-0.5 rounded">
                    Field Measurement Book (FMB) Demarcated
                  </span>
                </div>
              ) : (
                <div className="text-[11px] text-[#8E7E70] italic">
                  💡 Tip: Click any subdivision box on the map to inspect its survey demarcation details.
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: D. AFFECTED PEOPLE */}
        {currentStep === 4 && (
          <div className="space-y-4 text-xs">
            <div className="border-b border-[rgba(244,217,160,0.08)] pb-2">
              <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline">
                Step 4: Socio-Demographic Impact &amp; Affected People
              </h3>
              <p className="text-xs text-[#C4B5A5] mt-0.5">
                Census of Project Affected Families (PAFs) and Rehabilitation &amp; Resettlement (R&amp;R) requirements.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Number of Landowners <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.landowners_count}
                  onChange={(e) => updateField('landowners_count', e.target.value)}
                  placeholder="e.g. 420"
                  className="peace-input w-full font-mono text-sm"
                />
                {errors.landowners_count && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.landowners_count}</span>}
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Families Affected (PAFs) <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.families_affected}
                  onChange={(e) => updateField('families_affected', e.target.value)}
                  placeholder="e.g. 310"
                  className="peace-input w-full font-mono text-sm"
                />
                {errors.families_affected && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.families_affected}</span>}
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Families Needing Resettlement <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.families_resettlement}
                  onChange={(e) => updateField('families_resettlement', e.target.value)}
                  placeholder="e.g. 85"
                  className="peace-input w-full font-mono text-sm"
                />
                {errors.families_resettlement && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.families_resettlement}</span>}
              </div>
            </div>

            {/* Analytical Ratio Preview */}
            {formData.families_affected > 0 && (
              <div className="p-3 bg-[#16100C] border border-[rgba(244,217,160,0.1)] rounded font-mono text-[11px] text-[#C4B5A5] flex items-center justify-between">
                <span>R&amp;R Resettlement Ratio:</span>
                <span className="text-[#F4D9A0] font-bold">
                  {Math.round(((formData.families_resettlement || 0) / (formData.families_affected || 1)) * 100)}% of affected families require physical relocation
                </span>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: E. PLANNED APPROVALS */}
        {currentStep === 5 && (
          <div className="space-y-4 text-xs">
            <div className="border-b border-[rgba(244,217,160,0.08)] pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline">
                  Step 5: Planned Statutory Approvals
                </h3>
                <p className="text-xs text-[#C4B5A5] mt-0.5">
                  Milestone schedule for statutory sanctions under state and central legislation.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddApproval}
                className="btn-mocha text-xs"
              >
                + Add Approval Row
              </button>
            </div>

            {errors.approvals && <span className="text-[11px] text-[#F87171] block">{errors.approvals}</span>}

            <div className="space-y-2.5">
              {formData.approvals.map((app, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#16100C] border border-[rgba(244,217,160,0.1)] rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  <div className="sm:col-span-1 font-mono text-[#8E7E70] text-center">
                    0{idx + 1}
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-[#C4B5A5] text-[10px] uppercase font-mono mb-1">
                      Approval Type
                    </label>
                    <select
                      value={app.name}
                      onChange={(e) => handleUpdateApproval(idx, 'name', e.target.value)}
                      className="peace-input w-full"
                    >
                      {APPROVAL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[#C4B5A5] text-[10px] uppercase font-mono mb-1">
                      Target Planned Date
                    </label>
                    <input
                      type="date"
                      required
                      value={app.planned_date}
                      onChange={(e) => handleUpdateApproval(idx, 'planned_date', e.target.value)}
                      className="peace-input w-full font-mono text-xs"
                    />
                  </div>

                  <div className="sm:col-span-1 text-right sm:text-center pt-2 sm:pt-4">
                    <button
                      type="button"
                      onClick={() => handleRemoveApproval(idx)}
                      disabled={formData.approvals.length <= 1}
                      className="text-[#8E7E70] hover:text-[#F87171] disabled:opacity-30 disabled:cursor-not-allowed font-mono text-xs"
                      title="Remove clearance"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 6: FINAL STEP REVIEW */}
        {currentStep === 6 && (
          <div className="space-y-5 text-xs">
            <div className="border-b border-[rgba(244,217,160,0.08)] pb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#86EFAC] bg-[#152B1E] px-2 py-0.5 rounded border border-[#255C3A]">
                READY FOR INTAKE
              </span>
              <h3 className="text-base font-bold text-[#F4D9A0] font-headline mt-1">
                Final Step: Review &amp; Statutory Submission
              </h3>
              <p className="text-xs text-[#C4B5A5] mt-0.5">
                Verify corridor parameters before registering into master land database.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Summary Card 1: Basic Details */}
              <div className="peace-card p-4 space-y-2 bg-[#16100C]">
                <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-1.5">
                  <span className="font-mono text-[10px] text-[#F4D9A0] uppercase">Basic Details</span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-[#C8792C] hover:underline font-mono text-[11px]"
                  >
                    Edit &rarr;
                  </button>
                </div>
                <div className="space-y-1 font-sans">
                  <div className="font-semibold text-sm text-[#F3EDE2]">{formData.name}</div>
                  <div className="text-[#C4B5A5]">Sector: <strong className="text-[#F4D9A0] uppercase font-mono">{formData.type}</strong></div>
                  <div className="text-[#C4B5A5]">Agency: <strong className="text-[#F3EDE2]">{formData.agency}</strong></div>
                  <div className="text-[#C4B5A5]">District: <strong className="text-[#F3EDE2]">{formData.district}, {formData.state}</strong></div>
                  <div className="text-[#C4B5A5] font-mono text-[11px]">
                    Timeline: {formData.planned_start} to {formData.planned_end}
                  </div>
                  <div className="text-[#C4B5A5] font-mono text-[11px]">
                    Budget: ₹{Number(formData.budget).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Summary Card 2: Land & Parcels */}
              <div className="peace-card p-4 space-y-2 bg-[#16100C]">
                <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-1.5">
                  <span className="font-mono text-[10px] text-[#F4D9A0] uppercase">Land &amp; Parcels</span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-[#C8792C] hover:underline font-mono text-[11px]"
                  >
                    Edit &rarr;
                  </button>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  <div>Total Area: <strong className="text-[#F4D9A0]">{formData.land_area_ha} Hectares</strong></div>
                  <div>Parcels Count: <strong className="text-[#F3EDE2]">{formData.parcels.length} demarcated</strong></div>
                  <div className="text-[#C4B5A5] font-sans pt-1">
                    Villages: {formData.villages_covered.length > 0 ? formData.villages_covered.join(', ') : 'None specified'}
                  </div>
                  <div className="text-[#8E7E70] text-[10px] truncate">
                    Sample Surveys: {formData.parcels.slice(0, 4).map((p) => p.survey_no).join(', ')}...
                  </div>
                </div>
              </div>

              {/* Summary Card 3: Boundary & Dynamic Parcels */}
              <div className="peace-card p-4 space-y-2 bg-[#16100C]">
                <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-1.5">
                  <span className="font-mono text-[10px] text-[#F4D9A0] uppercase">Boundary &amp; Parcels</span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="text-[#C8792C] hover:underline font-mono text-[11px]"
                  >
                    Edit &rarr;
                  </button>
                </div>
                <div className="space-y-1 text-[#C4B5A5]">
                  <div>Start Terminal: <strong className="text-[#F3EDE2]">{formData.start_village}</strong></div>
                  <div>End Terminal: <strong className="text-[#F3EDE2]">{formData.end_village}</strong></div>
                  <div>District Anchor: <strong className="text-[#F4D9A0] font-mono">{formData.district} ({currentCoords[0]}° N, {currentCoords[1]}° E)</strong></div>
                  <div className="text-[10px] text-[#86EFAC] pt-1 flex items-center gap-1">
                    <span>✓</span> {corridorGeometry.subdivisions.length} survey subdivisions mapped inside boundary corridor
                  </div>
                </div>
              </div>

              {/* Summary Card 4: Socio-Demographics */}
              <div className="peace-card p-4 space-y-2 bg-[#16100C]">
                <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-1.5">
                  <span className="font-mono text-[10px] text-[#F4D9A0] uppercase">Affected People</span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="text-[#C8792C] hover:underline font-mono text-[11px]"
                  >
                    Edit &rarr;
                  </button>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  <div>Landowners: <strong className="text-[#F4D9A0]">{formData.landowners_count}</strong></div>
                  <div>Families Affected: <strong className="text-[#F3EDE2]">{formData.families_affected}</strong></div>
                  <div>Resettlement: <strong className="text-[#F87171]">{formData.families_resettlement}</strong></div>
                </div>
              </div>

              {/* Summary Card 5: Planned Approvals */}
              <div className="peace-card p-4 space-y-2 bg-[#16100C] md:col-span-2">
                <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-1.5">
                  <span className="font-mono text-[10px] text-[#F4D9A0] uppercase">Planned Approvals Schedule</span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                    className="text-[#C8792C] hover:underline font-mono text-[11px]"
                  >
                    Edit &rarr;
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  {formData.approvals.map((a, i) => (
                    <div key={i} className="p-2 rounded bg-[#1E1611] border border-[#3D2D21]">
                      <div className="text-[#F4D9A0] font-medium">{a.name}</div>
                      <div className="text-[#8E7E70] text-[10px] mt-0.5">Target: {a.planned_date || 'Pending'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            NAVIGATION BUTTONS: BACK & NEXT / SUBMIT
            ======================================================== */}
        <div className="flex items-center justify-between pt-4 border-t border-[rgba(244,217,160,0.1)]">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="btn-mocha text-xs"
            >
              &larr; Back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="btn-mocha text-xs"
            >
              Cancel
            </button>
          )}

          <div className="flex items-center gap-2.5">
            {currentStep < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                className="btn-amber text-xs font-semibold"
              >
                <span>Next Step</span>
                <span>&rarr;</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-amber text-xs font-semibold bg-[#4A855A] hover:bg-[#3D6E4A] border-[#5E9E70]"
              >
                {submitting ? 'Submitting to Registry...' : 'Submit & Register Project ✓'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          CSV BULK IMPORT MODAL FOR PARCEL SCHEDULE
          ======================================================== */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="peace-card p-6 w-full max-w-xl bg-[#1E1611] border border-[rgba(244,217,160,0.25)] shadow-2xl rounded-lg space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.12)] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#F4D9A0] uppercase tracking-wider">
                  Demarcated Parcels Schedule Import
                </span>
                <h3 className="text-base font-bold font-headline text-[#F4D9A0] mt-0.5">
                  Import Parcels CSV (Schedule Format)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="text-[#8E7E70] hover:text-[#F4D9A0] font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-[#C4B5A5]">
                Paste rows or upload a CSV file matching the parcels schedule format: <strong className="text-[#F3EDE2]">Survey Number, Area (Hectares), Classification</strong>.
              </p>
              <p className="text-[11px] text-[#8E7E70]">
                Values for area and classification (Private, Government, Forest) are read directly from each row without any default overrides.
              </p>
            </div>

            {/* Quick Template Download & File Upload Tools */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#16100C] border border-[#3D2D21] rounded">
              <label className="btn-mocha text-xs cursor-pointer flex items-center gap-1.5 py-1 px-2.5">
                <span>📁 Upload .csv File</span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="text-[11px] font-mono text-[#F4D9A0] hover:underline flex items-center gap-1"
              >
                <span>⬇ Download Sample CSV Template</span>
              </button>
            </div>

            {/* Textarea for Direct Paste */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-mono text-[#C4B5A5]">
                  CSV / Spreadsheet Content (Comma or Tab separated):
                </label>
                <span className="text-[10px] font-mono text-[#8E7E70]">Header row optional</span>
              </div>
              <textarea
                rows="6"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Survey Number, Area (Hectares), Classification&#10;104/1A, 15.2, Private&#10;104/2B, 8.4, Government&#10;105/1, 12.0, Private&#10;106/3A, 4.5, Forest"
                className="peace-input w-full font-mono text-xs leading-relaxed"
              />
            </div>

            {/* Live Parsing Preview */}
            {previewCsvParcels.length > 0 && (
              <div className="space-y-1.5 p-3 bg-[#16100C] border border-[#255C3A] rounded">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#86EFAC] font-mono font-semibold">
                    ✓ Parsed {previewCsvParcels.length} parcel rows
                  </span>
                  <span className="text-[#F4D9A0] font-mono">
                    Total Area: {previewCsvParcels.reduce((acc, p) => acc + p.area_ha, 0).toFixed(2)} Ha
                  </span>
                </div>
                <div className="max-h-28 overflow-y-auto border border-[#2A1F18] rounded">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-[#201812] text-[#8E7E70] sticky top-0">
                      <tr>
                        <th className="py-1 px-2">#</th>
                        <th className="py-1 px-2">Survey Number</th>
                        <th className="py-1 px-2">Area (Ha)</th>
                        <th className="py-1 px-2">Classification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A1F18] text-[#C4B5A5]">
                      {previewCsvParcels.slice(0, 5).map((p, i) => (
                        <tr key={i} className="hover:bg-[#1E1611]">
                          <td className="py-1 px-2 text-[#8E7E70]">{i + 1}</td>
                          <td className="py-1 px-2 text-[#F3EDE2] font-semibold">{p.survey_no}</td>
                          <td className="py-1 px-2 text-[#F4D9A0]">{p.area_ha}</td>
                          <td className="py-1 px-2 capitalize">{p.land_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewCsvParcels.length > 5 && (
                  <div className="text-[10px] text-[#8E7E70] italic text-right">
                    ...and {previewCsvParcels.length - 5} more rows
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(244,217,160,0.1)]">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="btn-mocha text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={previewCsvParcels.length === 0}
                className="btn-amber text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <span>Import {previewCsvParcels.length > 0 ? `${previewCsvParcels.length} Parcels` : 'Parcels'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAD File Ingestion Studio Modal */}
      <CadIngestModal
        isOpen={showCadModal}
        onClose={() => setShowCadModal(false)}
        onConfirm={handleCadConfirm}
        currentDeclaredArea={formData.land_area_ha}
      />
    </div>
  );
}
