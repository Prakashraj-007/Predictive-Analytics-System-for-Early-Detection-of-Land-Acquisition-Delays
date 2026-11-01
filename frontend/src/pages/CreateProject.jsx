import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { createProject } from '../api/projects';
import SyntheticNote from '../components/SyntheticNote';

const DRAFT_STORAGE_KEY = 'landsentinel_project_draft';

const INITIAL_FORM_STATE = {
  // Step 1: Basic details
  name: '',
  type: 'highway',
  agency: '',
  state: 'Maharashtra',
  district: 'Pune',
  planned_start: '',
  planned_end: '',
  budget: '',

  // Step 2: Land requirement
  land_area_ha: '',
  villages_covered: [],
  parcels: [
    { survey_no: '', area_ha: '', land_type: 'private' },
  ],

  // Step 3: Location
  start_village: '',
  end_village: '',

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

const DISTRICTS = ['Pune', 'Thane', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur', 'Satara'];

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

  // Bulk CSV Paste Modal/Drawer State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvDefaultArea, setCsvDefaultArea] = useState(10);
  const [csvDefaultType, setCsvDefaultType] = useState('private');

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

  // CSV Paste Bulk Import Handler
  const handleImportCsv = () => {
    if (!csvText.trim()) return;

    // Extract survey numbers split by commas, semicolons, or newlines
    const rawTokens = csvText
      .split(/[\r\n,;]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (rawTokens.length === 0) return;

    const importedParcels = rawTokens.map((surveyNo) => ({
      survey_no: surveyNo,
      area_ha: Number(csvDefaultArea) || 5,
      land_type: csvDefaultType,
    }));

    setFormData((prev) => ({
      ...prev,
      parcels: [...prev.parcels, ...importedParcels],
    }));

    setCsvText('');
    setShowCsvModal(false);
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
      if (!formData.start_village.trim()) errs.start_village = 'Alignment Start Village is mandatory';
      if (!formData.end_village.trim()) errs.end_village = 'Alignment End Village is mandatory';
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
          state: formData.state.trim() || 'Maharashtra',
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
    { num: 3, key: 'location', label: 'Location' },
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
                  placeholder="e.g. Pune-Nashik Semi-High Speed Rail Corridor (Phase 1)"
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
                title="Paste survey numbers from CSV or spreadsheet"
              >
                📋 Paste CSV Survey Nos
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
                <button
                  type="button"
                  onClick={handleAddParcel}
                  className="btn-mocha text-xs"
                >
                  + Add Parcel Row
                </button>
              </div>

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

        {/* STEP 3: C. LOCATION */}
        {currentStep === 3 && (
          <div className="space-y-4 text-xs">
            <div className="border-b border-[rgba(244,217,160,0.08)] pb-2">
              <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline">
                Step 3: Corridor Alignment &amp; Location
              </h3>
              <p className="text-xs text-[#C4B5A5] mt-0.5">
                Terminal alignment points for corridor geo-referencing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Alignment Start Village <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.start_village}
                  onChange={(e) => updateField('start_village', e.target.value)}
                  placeholder="e.g. Rajgurunagar North Boundary"
                  className="peace-input w-full"
                />
                {errors.start_village && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.start_village}</span>}
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Alignment End Village <span className="text-[#F87171]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.end_village}
                  onChange={(e) => updateField('end_village', e.target.value)}
                  placeholder="e.g. Manchar Industrial Bypass"
                  className="peace-input w-full"
                />
                {errors.end_village && <span className="text-[11px] text-[#F87171] mt-1 block">{errors.end_village}</span>}
              </div>
            </div>

            {/* Note: "(lat/lon are looked up by the backend; show a small note)" */}
            <div className="p-3.5 bg-[#16100C] border border-[#5B4632] rounded-lg text-xs text-[#C4B5A5] flex items-start gap-2.5">
              <svg className="w-4 h-4 text-[#F4D9A0] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <strong className="text-[#F4D9A0] block">Automated Geospatial Resolution:</strong>
                <span>(lat/lon are looked up by the backend from state cadastral survey records upon draft creation).</span>
              </div>
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

              {/* Summary Card 3: Alignment Location */}
              <div className="peace-card p-4 space-y-2 bg-[#16100C]">
                <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-1.5">
                  <span className="font-mono text-[10px] text-[#F4D9A0] uppercase">Alignment</span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="text-[#C8792C] hover:underline font-mono text-[11px]"
                  >
                    Edit &rarr;
                  </button>
                </div>
                <div className="space-y-1 text-[#C4B5A5]">
                  <div>Start: <strong className="text-[#F3EDE2]">{formData.start_village}</strong></div>
                  <div>End: <strong className="text-[#F3EDE2]">{formData.end_village}</strong></div>
                  <div className="text-[10px] text-[#8E7E70] italic pt-1">
                    (Coordinates auto-resolved by backend)
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
          CSV BULK IMPORT MODAL FOR SURVEY NUMBERS
          ======================================================== */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="peace-card p-6 w-full max-w-lg bg-[#1E1611] border border-[rgba(244,217,160,0.25)] shadow-2xl rounded-lg space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.12)] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#F4D9A0] uppercase tracking-wider">
                  Bulk Data Import
                </span>
                <h3 className="text-base font-bold font-headline text-[#F4D9A0] mt-0.5">
                  Paste Survey Numbers (CSV)
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

            <p className="text-xs text-[#C4B5A5]">
              Paste comma-separated, space-separated, or newline-separated survey numbers copied from Excel or a survey list.
            </p>

            <textarea
              rows="5"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="e.g.&#10;101/1, 101/2, 102/3A&#10;103, 104/B, 105"
              className="peace-input w-full font-mono text-xs leading-relaxed"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#C4B5A5] text-[10px] uppercase font-mono mb-1">
                  Default Area per Parcel (Ha)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={csvDefaultArea}
                  onChange={(e) => setCsvDefaultArea(e.target.value)}
                  className="peace-input w-full font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[#C4B5A5] text-[10px] uppercase font-mono mb-1">
                  Default Classification
                </label>
                <select
                  value={csvDefaultType}
                  onChange={(e) => setCsvDefaultType(e.target.value)}
                  className="peace-input w-full text-xs capitalize"
                >
                  <option value="private">Private</option>
                  <option value="government">Government</option>
                  <option value="forest">Forest</option>
                </select>
              </div>
            </div>

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
                disabled={!csvText.trim()}
                className="btn-amber text-xs font-semibold"
              >
                Import Survey Numbers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
