'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Toast from '@/components/ui/Toast';
import { consultationApi, type ConsultationContext, type ConsultationPrescription, type MedicationInput } from '@/lib/api/consultationApi';

interface ConsultationWorkspaceProps {
  appointmentId: string;
}

interface VisitFormState {
  reasonForVisit: string;
  diagnosis: string;
  notes: string;
  bloodPressure: string;
  weight: string;
  height: string;
  temperature: string;
}

interface MedicationRow {
  key: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
}

type Mode = 'edit' | 'review' | 'issued';

const EMPTY_VISIT_FORM: VisitFormState = {
  reasonForVisit: '',
  diagnosis: '',
  notes: '',
  bloodPressure: '',
  weight: '',
  height: '',
  temperature: '',
};

let rowCounter = 0;
const newRowKey = () => `med-${Date.now()}-${rowCounter++}`;

const emptyMedicationRow = (): MedicationRow => ({
  key: newRowKey(),
  medicationName: '',
  dosage: '',
  frequency: '',
  duration: '',
  quantity: '',
  instructions: '',
});

const rowFromMedication = (item: MedicationInput & { medication_name?: string | null }): MedicationRow => ({
  key: newRowKey(),
  medicationName: item.medicationName || item.medication_name || '',
  dosage: item.dosage || '',
  frequency: item.frequency || '',
  duration: item.duration || '',
  quantity: item.quantity === null || item.quantity === undefined ? '' : String(item.quantity),
  instructions: item.instructions || '',
});

const emptyVisitForm = (): VisitFormState => ({ ...EMPTY_VISIT_FORM });

const formFromContext = (context: ConsultationContext): VisitFormState => ({
  reasonForVisit: context.visit?.reason_for_visit || context.appointment.reason_for_visit || '',
  diagnosis: context.visit?.diagnosis || '',
  notes: context.visit?.notes || '',
  bloodPressure: context.visit?.blood_pressure || '',
  weight: context.visit?.weight === null || context.visit?.weight === undefined ? '' : String(context.visit.weight),
  height: context.visit?.height === null || context.visit?.height === undefined ? '' : String(context.visit.height),
  temperature: context.visit?.temperature === null || context.visit?.temperature === undefined ? '' : String(context.visit.temperature),
});

const formatDateTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const patientName = (context: ConsultationContext) =>
  [context.patient.first_name, context.patient.middle_name, context.patient.last_name]
    .filter(Boolean)
    .join(' ');

const ageFromDob = (dob?: string | null): number | null => {
  if (!dob) return null;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age -= 1;
  return age >= 0 ? age : null;
};

const sexLabel = (sex?: string | null) => {
  if (!sex || sex === 'NOT_SPECIFIED') return 'Not specified';
  if (sex === 'MALE') return 'Male';
  if (sex === 'FEMALE') return 'Female';
  if (sex === 'OTHER') return 'Other';
  return sex;
};

const medicationToInput = (row: MedicationRow): MedicationInput => ({
  medicationName: row.medicationName.trim(),
  dosage: row.dosage.trim() || null,
  frequency: row.frequency.trim() || null,
  duration: row.duration.trim() || null,
  quantity: row.quantity.trim() === '' ? null : Number(row.quantity),
  instructions: row.instructions.trim() || null,
});

export default function ConsultationWorkspace({ appointmentId }: ConsultationWorkspaceProps) {
  const router = useRouter();

  const [context, setContext] = useState<ConsultationContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>('edit');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [form, setForm] = useState<VisitFormState>(emptyVisitForm());
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const [bannerEditor, setBannerEditor] = useState<'allergies' | 'medications' | null>(null);
  const [allergyDraft, setAllergyDraft] = useState('');
  const [allergyNone, setAllergyNone] = useState(false);
  const [medicationDraft, setMedicationDraft] = useState('');
  const [medicationNone, setMedicationNone] = useState(false);
  const [isSavingPatient, setIsSavingPatient] = useState(false);

  const [missingDob, setMissingDob] = useState('');
  const [missingSex, setMissingSex] = useState('');

  const [editIssuedVisit, setEditIssuedVisit] = useState(false);
  const [issuedForm, setIssuedForm] = useState<VisitFormState>(emptyVisitForm());
  const [editReason, setEditReason] = useState('');
  const [isSavingVisit, setIsSavingVisit] = useState(false);

  const [voidTarget, setVoidTarget] = useState<ConsultationPrescription | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const [replacementSource, setReplacementSource] = useState<ConsultationPrescription | null>(null);
  const [replacementMeds, setReplacementMeds] = useState<MedicationRow[]>([]);
  const [replacementNotes, setReplacementNotes] = useState('');
  const [isIssuingReplacement, setIsIssuingReplacement] = useState(false);

  const [busyPdfId, setBusyPdfId] = useState<string | null>(null);

  const baseUpdatedAtRef = useRef<string | null>(null);
  const lastSavedSignatureRef = useRef<string>('');
  const skipFirstAutosaveRef = useRef(true);

  const buildPayload = useCallback(
    (currentForm: VisitFormState, currentMeds: MedicationRow[], currentNotes: string) => ({
      reasonForVisit: currentForm.reasonForVisit.trim() || null,
      diagnosis: currentForm.diagnosis.trim() || null,
      notes: currentForm.notes.trim() || null,
      bloodPressure: currentForm.bloodPressure.trim() || null,
      weight: currentForm.weight.trim() === '' ? null : Number(currentForm.weight),
      height: currentForm.height.trim() === '' ? null : Number(currentForm.height),
      temperature: currentForm.temperature.trim() === '' ? null : Number(currentForm.temperature),
      prescriptionDraft: {
        items: currentMeds
          .map(medicationToInput)
          .filter((item) => item.medicationName.length > 0),
        notes: currentNotes.trim() || null,
      },
    }),
    []
  );

  const applyContext = useCallback((next: ConsultationContext) => {
    setContext(next);
    setMode(next.visit?.status === 'ISSUED' ? 'issued' : 'edit');
    const nextForm = formFromContext(next);
    const draftItems = next.visit?.prescription_draft?.items || [];
    const nextMeds = draftItems.length > 0 ? draftItems.map(rowFromMedication) : [];
    const nextNotes = next.visit?.prescription_draft?.notes || '';
    setForm(nextForm);
    setIssuedForm(nextForm);
    setMedications(nextMeds);
    setPrescriptionNotes(nextNotes);
    baseUpdatedAtRef.current = next.visit?.draft_updated_at || null;
    lastSavedSignatureRef.current = JSON.stringify(buildPayload(nextForm, nextMeds, nextNotes));
    skipFirstAutosaveRef.current = true;
    setConflict(false);
    setLastSavedAt(next.visit?.status === 'DRAFT' ? next.visit?.draft_updated_at || null : null);
    setMissingDob(next.patient.date_of_birth || '');
    setMissingSex(next.patient.sex && next.patient.sex !== 'NOT_SPECIFIED' ? next.patient.sex : '');
    setEditIssuedVisit(false);
  }, [buildPayload]);

  const loadContext = useCallback(async () => {
    const response = await consultationApi.getContext(appointmentId);
    if (!response.success || !response.data) {
      setError(response.error || 'Failed to load appointment');
      return null;
    }
    return response.data;
  }, [appointmentId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        let data = await loadContext();
        if (cancelled || !data) return;

        // Starting a consultation creates the draft exactly once. Reopening it
        // returns the same row, so this is safe to call on every load.
        if (!data.visit && data.canStart) {
          setIsStarting(true);
          const started = await consultationApi.start(appointmentId);
          if (cancelled) return;
          if (!started.success) {
            setToast({ message: started.error || 'Failed to start consultation', type: 'error' });
          }
          data = (await loadContext()) || data;
        }

        if (cancelled) return;
        applyContext(data);
      } catch (err) {
        if (!cancelled) setError('Network error occurred');
      } finally {
        if (!cancelled) {
          setIsStarting(false);
          setIsLoading(false);
        }
      }
    };

    load();

    consultationApi.getMedicationSuggestions().then((response) => {
      if (!cancelled && response.success && response.data) setSuggestions(response.data);
    });

    return () => {
      cancelled = true;
    };
  }, [appointmentId, applyContext, loadContext]);

  const payloadSignature = useMemo(
    () => JSON.stringify(buildPayload(form, medications, prescriptionNotes)),
    [buildPayload, form, medications, prescriptionNotes]
  );

  const saveDraft = useCallback(
    async (options: { force?: boolean } = {}) => {
      if (!context?.visit || context.visit.status !== 'DRAFT') return true;
      if (conflict && !options.force) return false;

      const signature = JSON.stringify(buildPayload(form, medications, prescriptionNotes));
      if (!options.force && signature === lastSavedSignatureRef.current) return true;

      setIsSaving(true);
      try {
        const response = await consultationApi.saveDraft(context.visit.id, {
          ...buildPayload(form, medications, prescriptionNotes),
          baseUpdatedAt: baseUpdatedAtRef.current,
        });

        if (response.success && response.data) {
          baseUpdatedAtRef.current = response.data.draft_updated_at || null;
          lastSavedSignatureRef.current = signature;
          setLastSavedAt(response.data.draft_updated_at || new Date().toISOString());
          setContext((current) => (current ? { ...current, visit: response.data! } : current));
          setConflict(false);
          return true;
        }

        if (response.error?.toLowerCase().includes('another tab') || response.error?.toLowerCase().includes('reload')) {
          setConflict(true);
        }
        setToast({ message: response.error || 'Failed to autosave draft', type: 'error' });
        return false;
      } catch (err) {
        setToast({ message: 'Network error while autosaving', type: 'error' });
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [buildPayload, conflict, context?.visit, form, medications, prescriptionNotes]
  );

  useEffect(() => {
    if (mode !== 'edit' || !context?.visit || context.visit.status !== 'DRAFT' || conflict) return;
    if (skipFirstAutosaveRef.current) {
      skipFirstAutosaveRef.current = false;
      return;
    }
    if (payloadSignature === lastSavedSignatureRef.current) return;

    const timer = setTimeout(() => {
      void saveDraft();
    }, 1200);

    return () => clearTimeout(timer);
  }, [payloadSignature, mode, context?.visit, conflict, saveDraft]);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const started = await consultationApi.start(appointmentId);
      if (!started.success) {
        setToast({ message: started.error || 'Failed to start consultation', type: 'error' });
        return;
      }
      const data = await loadContext();
      if (data) applyContext(data);
    } finally {
      setIsStarting(false);
    }
  };

  const handleFinish = async () => {
    if (!form.reasonForVisit.trim()) {
      setToast({ message: 'Reason for visit is required before reviewing', type: 'error' });
      return;
    }
    setIsFinishing(true);
    try {
      const saved = await saveDraft({ force: true });
      if (!saved) return;
      setMode('review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsFinishing(false);
    }
  };

  const handleIssue = async () => {
    if (!context?.visit) return;
    if (context.missingPatientInfo.length > 0) {
      setToast({ message: 'Add the missing patient information before issuing', type: 'error' });
      return;
    }
    setIsIssuing(true);
    try {
      const response = await consultationApi.issue(context.visit.id, buildPayload(form, medications, prescriptionNotes));
      if (!response.success || !response.data) {
        setToast({ message: response.error || 'Failed to issue consultation', type: 'error' });
        return;
      }

      const result = response.data;
      const nextPrescriptions = result.prescription
        ? [result.prescription, ...(context.prescriptions || [])]
        : context.prescriptions;

      const refreshed = await loadContext();
      if (refreshed) {
        applyContext(refreshed);
      } else {
        setContext({
          ...context,
          visit: result.visit,
          prescriptions: nextPrescriptions,
          doctorFinished: true,
          isDraft: false,
          canIssue: false,
          missingPatientInfo: [],
        });
        setMode('issued');
      }
      setToast({
        message: result.pdfGenerated
          ? 'Consultation issued'
          : 'Consultation issued. The PDF could not be generated — use Retry PDF.',
        type: result.pdfGenerated ? 'success' : 'error',
      });
    } finally {
      setIsIssuing(false);
    }
  };

  const handleSavePatientInfo = async () => {
    if (!context) return;
    const payload: Record<string, unknown> = {};
    if (missingDob && missingDob !== context.patient.date_of_birth) payload.dateOfBirth = missingDob;
    if (missingSex && missingSex !== context.patient.sex) payload.sex = missingSex;
    if (Object.keys(payload).length === 0) return;

    setIsSavingPatient(true);
    try {
      const response = await consultationApi.updatePatient(context.patient.id, payload);
      if (!response.success || !response.data) {
        setToast({ message: response.error || 'Failed to update patient', type: 'error' });
        return;
      }
      const updated = response.data;
      const missing = [...context.missingPatientInfo];
      const nextMissing = missing.filter((item) => {
        if (item === 'dateOfBirth') return !updated.date_of_birth;
        if (item === 'sex') return !updated.sex || updated.sex === 'NOT_SPECIFIED';
        return false;
      });
      setContext({
        ...context,
        patient: { ...context.patient, ...updated },
        missingPatientInfo: nextMissing,
      });
      setToast({ message: 'Patient information saved', type: 'success' });
    } finally {
      setIsSavingPatient(false);
    }
  };

  const openBannerEditor = (kind: 'allergies' | 'medications') => {
    if (!context) return;
    setBannerEditor(kind);
    if (kind === 'allergies') {
      setAllergyDraft(context.patient.allergies || '');
      setAllergyNone(Boolean(context.patient.allergies_confirmed_none));
    } else {
      setMedicationDraft(context.patient.current_medications || '');
      setMedicationNone(Boolean(context.patient.medications_confirmed_none));
    }
  };

  const saveBanner = async () => {
    if (!context || !bannerEditor) return;
    setIsSavingPatient(true);
    try {
      const payload =
        bannerEditor === 'allergies'
          ? {
              allergies: allergyNone ? null : allergyDraft.trim() || null,
              allergiesConfirmedNone: allergyNone,
            }
          : {
              currentMedications: medicationNone ? null : medicationDraft.trim() || null,
              medicationsConfirmedNone: medicationNone,
            };

      const response = await consultationApi.updatePatient(context.patient.id, payload);
      if (!response.success || !response.data) {
        setToast({ message: response.error || 'Failed to update patient record', type: 'error' });
        return;
      }
      setContext({ ...context, patient: { ...context.patient, ...response.data } });
      setBannerEditor(null);
      setToast({ message: 'Patient record updated', type: 'success' });
    } finally {
      setIsSavingPatient(false);
    }
  };

  const updateMedication = (key: string, field: keyof MedicationRow, value: string) => {
    setMedications((rows) => rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  };

  const addMedication = (item?: MedicationInput) => {
    setMedications((rows) => [...rows, item ? rowFromMedication(item) : emptyMedicationRow()]);
  };

  const removeMedication = (key: string) => {
    setMedications((rows) => rows.filter((row) => row.key !== key));
  };

  const copyFromPrevious = () => {
    if (!context?.previousPrescription) return;
    const items = context.previousPrescription.items || [];
    if (items.length === 0) return;
    setMedications((rows) => [...rows, ...items.map(rowFromMedication)]);
    setToast({ message: 'Copied medications from the previous prescription', type: 'success' });
  };

  const addFavorite = async (row: MedicationRow) => {
    if (!row.medicationName.trim()) {
      setToast({ message: 'Enter a medication name before saving a favorite', type: 'error' });
      return;
    }
    const response = await consultationApi.saveFavorite({
      medicationName: row.medicationName.trim(),
      dosage: row.dosage.trim() || undefined,
      frequency: row.frequency.trim() || undefined,
      duration: row.duration.trim() || undefined,
      instructions: row.instructions.trim() || undefined,
    });
    if (!response.success || !response.data) {
      setToast({ message: response.error || 'Failed to save favorite', type: 'error' });
      return;
    }
    setContext((current) =>
      current
        ? {
            ...current,
            favorites: [response.data!, ...current.favorites.filter((favorite) => favorite.id !== response.data!.id)],
          }
        : current
    );
    setToast({ message: 'Saved to favorites', type: 'success' });
  };

  const removeFavorite = async (id: string) => {
    const response = await consultationApi.removeFavorite(id);
    if (!response.success) {
      setToast({ message: response.error || 'Failed to remove favorite', type: 'error' });
      return;
    }
    setContext((current) =>
      current ? { ...current, favorites: current.favorites.filter((favorite) => favorite.id !== id) } : current
    );
  };

  const openVoid = (prescription: ConsultationPrescription) => {
    setVoidTarget(prescription);
    setVoidReason('');
  };

  const submitVoid = async () => {
    if (!voidTarget || !context) return;
    if (voidReason.trim().length < 3) {
      setToast({ message: 'Enter a reason for voiding the prescription', type: 'error' });
      return;
    }
    setIsVoiding(true);
    try {
      const response = await consultationApi.voidPrescription(voidTarget.id, voidReason.trim());
      if (!response.success || !response.data) {
        setToast({ message: response.error || 'Failed to void prescription', type: 'error' });
        return;
      }
      const updated = response.data.prescription;
      setContext({
        ...context,
        prescriptions: context.prescriptions.map((prescription) =>
          prescription.id === updated.id ? { ...prescription, ...updated } : prescription
        ),
      });
      setVoidTarget(null);
      setToast({ message: 'Prescription voided', type: 'success' });
    } finally {
      setIsVoiding(false);
    }
  };

  const startReplacement = (prescription: ConsultationPrescription) => {
    setReplacementSource(prescription);
    setReplacementMeds((prescription.items || []).map(rowFromMedication));
    setReplacementNotes(prescription.notes || '');
    setShowFavorites(false);
  };

  const submitReplacement = async () => {
    if (!context?.visit || !replacementSource) return;
    const items = replacementMeds.map(medicationToInput).filter((item) => item.medicationName.length > 0);
    if (items.length === 0) {
      setToast({ message: 'Add at least one medication', type: 'error' });
      return;
    }
    setIsIssuingReplacement(true);
    try {
      const response = await consultationApi.issueReplacement(context.visit.id, {
        prescriptionDraft: { items, notes: replacementNotes.trim() || null },
      });
      if (!response.success || !response.data) {
        setToast({ message: response.error || 'Failed to issue replacement', type: 'error' });
        return;
      }
      const data = await loadContext();
      if (data) applyContext(data);
      setReplacementSource(null);
      setToast({
        message: response.data.pdfGenerated
          ? 'Replacement prescription issued'
          : 'Replacement issued. The PDF could not be generated — use Retry PDF.',
        type: response.data.pdfGenerated ? 'success' : 'error',
      });
    } finally {
      setIsIssuingReplacement(false);
    }
  };

  const handleSaveIssuedVisit = async () => {
    if (!context?.visit) return;
    if (!issuedForm.reasonForVisit.trim()) {
      setToast({ message: 'Reason for visit is required', type: 'error' });
      return;
    }
    setIsSavingVisit(true);
    try {
      const response = await consultationApi.updateVisit(context.visit.id, {
        reasonForVisit: issuedForm.reasonForVisit.trim(),
        diagnosis: issuedForm.diagnosis.trim(),
        notes: issuedForm.notes.trim(),
        bloodPressure: issuedForm.bloodPressure.trim(),
        weight: issuedForm.weight.trim() === '' ? undefined : Number(issuedForm.weight),
        height: issuedForm.height.trim() === '' ? undefined : Number(issuedForm.height),
        temperature: issuedForm.temperature.trim() === '' ? undefined : Number(issuedForm.temperature),
        editReason: editReason.trim() || undefined,
      });
      if (!response.success) {
        setToast({ message: response.error || 'Failed to update visit', type: 'error' });
        return;
      }
      const data = await loadContext();
      if (data) applyContext(data);
      setEditReason('');
      setToast({ message: 'Visit updated', type: 'success' });
    } finally {
      setIsSavingVisit(false);
    }
  };

  const handlePdf = async (prescription: ConsultationPrescription) => {
    setBusyPdfId(prescription.id);
    try {
      const response = prescription.has_pdf
        ? await (await import('@/lib/api/doctorApi')).doctorApi.getPrescriptionPdfUrl(prescription.id)
        : await (await import('@/lib/api/doctorApi')).doctorApi.generatePrescriptionPdf(prescription.id);
      if (response.success && response.data?.signedUrl) {
        window.open(response.data.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        setToast({ message: response.error || 'Failed to get prescription PDF', type: 'error' });
      }
    } finally {
      setBusyPdfId(null);
    }
  };

  const allergiesState = useMemo(() => {
    if (!context) return { kind: 'missing' as const, text: '' };
    if (context.patient.allergies) return { kind: 'recorded' as const, text: context.patient.allergies };
    if (context.patient.allergies_confirmed_none) return { kind: 'none' as const, text: 'No known allergies' };
    return { kind: 'missing' as const, text: 'not recorded yet' };
  }, [context]);

  const medicationsState = useMemo(() => {
    if (!context) return { kind: 'missing' as const, text: '' };
    if (context.patient.current_medications) return { kind: 'recorded' as const, text: context.patient.current_medications };
    if (context.patient.medications_confirmed_none) return { kind: 'none' as const, text: 'No current medications' };
    return { kind: 'missing' as const, text: 'not recorded yet' };
  }, [context]);

  if (isLoading || isStarting) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-slate-600">{isStarting ? 'Starting consultation...' : 'Loading consultation...'}</p>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
        <p className="text-red-600">{error || 'Consultation not found'}</p>
        <button
          onClick={() => router.push('/doctor/appointments')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Appointments
        </button>
      </div>
    );
  }

  const formField = (label: string, key: keyof VisitFormState, placeholder: string, type: 'text' | 'number' | 'textarea' = 'text') => (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      {type === 'textarea' ? (
        <textarea
          rows={4}
          value={form[key]}
          onChange={(event) => setForm({ ...form, [key]: event.target.value })}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={(event) => setForm({ ...form, [key]: event.target.value })}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      )}
    </div>
  );

  const issuedField = (label: string, key: keyof VisitFormState, type: 'text' | 'number' | 'textarea' = 'text') => (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      {type === 'textarea' ? (
        <textarea
          rows={4}
          value={issuedForm[key]}
          onChange={(event) => setIssuedForm({ ...issuedForm, [key]: event.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      ) : (
        <input
          type={type}
          value={issuedForm[key]}
          onChange={(event) => setIssuedForm({ ...issuedForm, [key]: event.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      )}
    </div>
  );

  const validationRow = () => {
    if (context.missingPatientInfo.length === 0) return null;
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-amber-600">warning</span>
          <div>
            <p className="text-sm font-semibold text-amber-900">Missing patient information</p>
            <p className="text-xs text-amber-800">
              The prescription PDF needs the patient&apos;s date of birth and sex. Add them before issuing.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {context.missingPatientInfo.includes('dateOfBirth') && (
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">Date of birth</label>
              <input
                type="date"
                value={missingDob}
                onChange={(event) => setMissingDob(event.target.value)}
                className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white"
              />
            </div>
          )}
          {context.missingPatientInfo.includes('sex') && (
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">Sex</label>
              <select
                value={missingSex}
                onChange={(event) => setMissingSex(event.target.value)}
                className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white"
              >
                <option value="">Select...</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          )}
        </div>
        <button
          onClick={handleSavePatientInfo}
          disabled={isSavingPatient || (!missingDob && !missingSex)}
          className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {isSavingPatient ? 'Saving...' : 'Save patient information'}
        </button>
      </div>
    );
  };

  const readOnlyVisit = (visit: typeof context.visit) => {
    if (!visit) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Reason for visit</p>
          <p className="text-slate-800 font-medium">{visit.reason_for_visit || '—'}</p>
        </div>
        <div>
          <p className="text-slate-500">Diagnosis</p>
          <p className="text-slate-800 font-medium">{visit.diagnosis || '—'}</p>
        </div>
        <div className="md:col-span-2">
          <p className="text-slate-500">Notes</p>
          <p className="text-slate-800 whitespace-pre-wrap">{visit.notes || '—'}</p>
        </div>
        <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-slate-500">Blood pressure</p>
            <p className="text-slate-800 font-medium">{visit.blood_pressure || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500">Weight</p>
            <p className="text-slate-800 font-medium">{visit.weight ? `${visit.weight} kg` : '—'}</p>
          </div>
          <div>
            <p className="text-slate-500">Height</p>
            <p className="text-slate-800 font-medium">{visit.height ? `${visit.height} cm` : '—'}</p>
          </div>
          <div>
            <p className="text-slate-500">Temperature</p>
            <p className="text-slate-800 font-medium">{visit.temperature ? `${visit.temperature} °C` : '—'}</p>
          </div>
        </div>
      </div>
    );
  };

  const prescriptionReadOnly = (prescription: ConsultationPrescription) => (
    <div key={prescription.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">
            {formatDate(prescription.prescription_date)}
          </span>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              prescription.status === 'VOIDED'
                ? 'bg-red-100 text-red-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {prescription.status === 'VOIDED' ? 'Voided' : 'Issued'}
          </span>
          {prescription.replaces_prescription_id && (
            <span className="text-xs text-slate-500">Replacement</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {prescription.status === 'ISSUED' && (
            <>
              <button
                onClick={() => handlePdf(prescription)}
                disabled={busyPdfId === prescription.id}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busyPdfId === prescription.id
                  ? 'Preparing...'
                  : prescription.has_pdf
                  ? 'Print / Download PDF'
                  : 'Generate PDF'}
              </button>
              <button
                onClick={() => openVoid(prescription)}
                className="px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Void and replace
              </button>
            </>
          )}
          {prescription.status === 'VOIDED' && !context.prescriptions.some((item) => item.status === 'ISSUED') && (
            <button
              onClick={() => startReplacement(prescription)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
            >
              Issue replacement
            </button>
          )}
        </div>
      </div>
      {prescription.void_reason && (
        <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
          Void reason: {prescription.void_reason}
        </p>
      )}
      <div className="space-y-2">
        {(prescription.items || []).map((item) => (
          <div key={item.id} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
            <p className="font-medium text-slate-800">{item.medication_name || item.medicationName}</p>
            <p className="text-xs text-slate-600">
              {[item.dosage, item.frequency, item.duration, item.quantity ? `qty ${item.quantity}` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {item.instructions && <p className="text-xs text-slate-500">{item.instructions}</p>}
          </div>
        ))}
        {prescription.items.length === 0 && <p className="text-sm text-slate-500">No medications recorded.</p>}
      </div>
      {prescription.notes && <p className="text-sm text-slate-700 whitespace-pre-wrap">{prescription.notes}</p>}
    </div>
  );

  const allPrescriptions = context.prescriptions || [];
  const hasActivePrescription = allPrescriptions.some((prescription) => prescription.status === 'ISSUED');
  const lastVisitLabel = context.firstVisit ? 'First visit' : formatDate(context.lastVisitDate);

  return (
    <div className="space-y-6 pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            onClick={() => router.push('/doctor/appointments')}
            className="text-slate-600 hover:text-slate-900 mb-2 flex items-center gap-2 text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Appointments
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'review' ? 'Review before issuing' : mode === 'issued' ? 'Consultation record' : 'Consultation'}
            {context.appointment.queue_number ? ` · Q-${String(context.appointment.queue_number).padStart(2, '0')}` : ''}
            {` · ${patientName(context)}`}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {formatDateTime(context.appointment.appointment_date)}
            {context.appointment.queue_status ? ` · Queue ${context.appointment.queue_status.replace('_', ' ')}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {context.doctorFinished && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              Doctor finished
            </span>
          )}
          {context.visit?.is_edited && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              Edited {formatDateTime(context.visit.edited_at)}
            </span>
          )}
          {context.isInCheckup && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              In checkup{context.appointment.queue_started_at ? ` since ${formatTime(context.appointment.queue_started_at)}` : ''}
            </span>
          )}
          {context.appointment.status === 'CANCELLED' || context.appointment.status === 'NO_SHOW' ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              Appointment {context.appointment.status.replace('_', ' ')}
            </span>
          ) : null}
        </div>
      </div>

      {/* Patient banner */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              {context.patient.first_name[0]}{context.patient.last_name[0]}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{patientName(context)}</p>
              <p className="text-xs text-slate-500">
                {ageFromDob(context.patient.date_of_birth) !== null ? `${ageFromDob(context.patient.date_of_birth)} years old` : 'Age not recorded'}
                {' · '}
                {sexLabel(context.patient.sex)}
                {' · Last visit: '}
                {lastVisitLabel}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <button
              onClick={() => openBannerEditor('allergies')}
              className={`flex items-center gap-2 text-left rounded-lg px-3 py-2 ${
                allergiesState.kind === 'missing'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : allergiesState.kind === 'none'
                  ? 'bg-slate-50 text-slate-600 border border-slate-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {allergiesState.kind === 'none' ? 'check_circle' : 'warning'}
              </span>
              <span>
                <span className="font-medium">Allergies:</span> {allergiesState.text}
              </span>
              <span className="ml-auto text-xs underline">{allergiesState.kind === 'missing' ? 'Add' : 'Edit'}</span>
            </button>
            <button
              onClick={() => openBannerEditor('medications')}
              className={`flex items-center gap-2 text-left rounded-lg px-3 py-2 ${
                medicationsState.kind === 'missing'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {medicationsState.kind === 'none' ? 'check_circle' : 'medication'}
              </span>
              <span>
                <span className="font-medium">Current meds:</span> {medicationsState.text}
              </span>
              <span className="ml-auto text-xs underline">{medicationsState.kind === 'missing' ? 'Add' : 'Edit'}</span>
            </button>
          </div>
        </div>

        {bannerEditor && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              {bannerEditor === 'allergies' ? 'Allergies' : 'Current medications'}
            </p>
            <textarea
              rows={2}
              value={bannerEditor === 'allergies' ? allergyDraft : medicationDraft}
              onChange={(event) =>
                bannerEditor === 'allergies'
                  ? setAllergyDraft(event.target.value)
                  : setMedicationDraft(event.target.value)
              }
              placeholder={bannerEditor === 'allergies' ? 'e.g., Penicillin' : 'e.g., Metformin 500mg twice daily'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={bannerEditor === 'allergies' ? allergyNone : medicationNone}
                onChange={(event) =>
                  bannerEditor === 'allergies'
                    ? setAllergyNone(event.target.checked)
                    : setMedicationNone(event.target.checked)
                }
              />
              Confirmed none
            </label>
            <div className="flex gap-2">
              <button
                onClick={saveBanner}
                disabled={isSavingPatient}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isSavingPatient ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setBannerEditor(null)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* No consultation started and not in checkup */}
      {!context.visit && !context.canStart && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Appointment details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Status</p>
              <p className="text-slate-800 font-medium">{context.appointment.status.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-slate-500">Reason for visit</p>
              <p className="text-slate-800 font-medium">{context.appointment.reason_for_visit || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Phone</p>
              <p className="text-slate-800 font-medium">{context.patient.phone || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Email</p>
              <p className="text-slate-800 font-medium">{context.patient.email || '—'}</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            A consultation can be started when the secretary marks this patient as In Checkup.
          </div>
        </div>
      )}

      {/* Start CTA */}
      {!context.visit && context.canStart && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Patient is in checkup</h2>
            <p className="text-sm text-slate-500">Start the consultation to record the visit and prescription.</p>
          </div>
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="px-5 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {isStarting ? 'Starting...' : 'Start consultation'}
          </button>
        </div>
      )}

      {context.visit && mode === 'edit' && (
        <>
          {conflict && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-red-800">
                <p className="font-semibold">This draft was updated in another tab.</p>
                <p>Reload the latest draft before saving so no changes are lost.</p>
              </div>
              <button
                onClick={async () => {
                  const data = await loadContext();
                  if (data) applyContext(data);
                }}
                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Reload latest
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">clinical_notes</span>
              Visit
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formField('Reason for visit', 'reasonForVisit', 'e.g., Acute respiratory infection')}
              {formField('Diagnosis', 'diagnosis', 'e.g., Upper respiratory tract infection')}
            </div>
            {formField('Clinical notes', 'notes', 'Clinical notes…', 'textarea')}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {formField('Blood pressure', 'bloodPressure', '120/80')}
              {formField('Weight (kg)', 'weight', '70', 'number')}
              {formField('Height (cm)', 'height', '170', 'number')}
              {formField('Temperature (°C)', 'temperature', '37.5', 'number')}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">medication</span>
                Prescription
              </h2>
              <div className="flex flex-wrap gap-2">
                {context.previousPrescription && (
                  <button
                    onClick={copyFromPrevious}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Copy from previous
                  </button>
                )}
                <button
                  onClick={() => setShowFavorites((current) => !current)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Favorites
                </button>
                <button
                  onClick={() => addMedication()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  + Add medication
                </button>
              </div>
            </div>

            {showFavorites && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                {context.favorites.length === 0 ? (
                  <p className="text-sm text-slate-500">No favorites yet. Use the star on a medication row to save one.</p>
                ) : (
                  context.favorites.map((favorite) => (
                    <div key={favorite.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2">
                      <button
                        onClick={() =>
                          addMedication({
                            medicationName: favorite.medication_name,
                            dosage: favorite.dosage,
                            frequency: favorite.frequency,
                            duration: favorite.duration,
                            instructions: favorite.instructions,
                          })
                        }
                        className="text-left text-sm flex-1"
                      >
                        <span className="font-medium text-slate-800">{favorite.medication_name}</span>
                        <span className="text-xs text-slate-500 ml-2">
                          {[favorite.dosage, favorite.frequency, favorite.duration].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                      <button
                        onClick={() => removeFavorite(favorite.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            <datalist id="medication-suggestions">
              {suggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            {medications.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                <p className="text-sm text-slate-500">No medications yet. No prescription will be created.</p>
                <button onClick={() => addMedication()} className="mt-2 text-sm text-blue-600 font-medium hover:underline">
                  Add the first medication
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {medications.map((row, index) => (
                  <div key={row.key} className="rounded-xl border border-slate-200 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">Medication {index + 1}</p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => addFavorite(row)}
                          title="Save as favorite"
                          className="text-slate-400 hover:text-amber-500"
                        >
                          <span className="material-symbols-outlined text-[20px]">star</span>
                        </button>
                        <button
                          onClick={() => removeMedication(row.key)}
                          title="Remove medication"
                          className="text-slate-400 hover:text-red-600"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        list="medication-suggestions"
                        value={row.medicationName}
                        onChange={(event) => updateMedication(row.key, 'medicationName', event.target.value)}
                        placeholder="Medication name"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <input
                        value={row.dosage}
                        onChange={(event) => updateMedication(row.key, 'dosage', event.target.value)}
                        placeholder="Dosage (e.g., 500mg, 1 cap)"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <input
                        value={row.frequency}
                        onChange={(event) => updateMedication(row.key, 'frequency', event.target.value)}
                        placeholder="Frequency (e.g., 3x daily)"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <input
                        value={row.duration}
                        onChange={(event) => updateMedication(row.key, 'duration', event.target.value)}
                        placeholder="Duration (e.g., 7 days)"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={(event) => updateMedication(row.key, 'quantity', event.target.value)}
                        placeholder="Quantity to dispense"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <input
                        value={row.instructions}
                        onChange={(event) => updateMedication(row.key, 'instructions', event.target.value)}
                        placeholder="Instructions"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Notes for patient</label>
              <textarea
                rows={3}
                value={prescriptionNotes}
                onChange={(event) => setPrescriptionNotes(event.target.value)}
                placeholder="Notes shown with the prescription…"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 lg:pl-64">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {conflict
                  ? 'Autosave paused — reload the latest draft'
                  : isSaving
                  ? 'Autosaving…'
                  : lastSavedAt
                  ? `Autosaved ${formatTime(lastSavedAt)}`
                  : 'Changes autosave as you type'}
              </p>
              <button
                onClick={handleFinish}
                disabled={isFinishing || isSaving || conflict}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {isFinishing ? 'Preparing review…' : 'Finish'}
              </button>
            </div>
          </div>
        </>
      )}

      {context.visit && mode === 'review' && (
        <>
          {validationRow()}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Visit</h2>
            {readOnlyVisit(context.visit)}
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Prescription</h2>
              <span className="text-xs text-slate-500">As the patient will see it</span>
            </div>
            {medications.filter((row) => row.medicationName.trim()).length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                No prescription will be created.
              </div>
            ) : (
              <div className="space-y-2">
                {medications
                  .filter((row) => row.medicationName.trim())
                  .map((row) => (
                    <div key={row.key} className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-sm font-medium text-slate-800">{row.medicationName}</p>
                      <p className="text-xs text-slate-600">
                        {[row.dosage, row.frequency, row.duration, row.quantity ? `qty ${row.quantity}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {row.instructions && <p className="text-xs text-slate-500">{row.instructions}</p>}
                    </div>
                  ))}
              </div>
            )}
            {prescriptionNotes.trim() && (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{prescriptionNotes}</p>
            )}
          </div>
          <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 lg:pl-64">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setMode('edit')}
                className="px-5 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to edit
              </button>
              <button
                onClick={handleIssue}
                disabled={isIssuing || context.missingPatientInfo.length > 0}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {isIssuing ? 'Issuing…' : 'Issue'}
              </button>
            </div>
          </div>
        </>
      )}

      {context.visit && mode === 'issued' && (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-800">Visit</h2>
              <div className="flex items-center gap-2">
                {context.visit.is_edited && (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                    Edited {formatDateTime(context.visit.edited_at)}
                  </span>
                )}
                <button
                  onClick={() => {
                    setIssuedForm(formFromContext(context));
                    setEditIssuedVisit((current) => !current);
                  }}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {editIssuedVisit ? 'Cancel edit' : 'Edit visit'}
                </button>
              </div>
            </div>

            {editIssuedVisit ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {issuedField('Reason for visit', 'reasonForVisit')}
                  {issuedField('Diagnosis', 'diagnosis')}
                </div>
                {issuedField('Clinical notes', 'notes', 'textarea')}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {issuedField('Blood pressure', 'bloodPressure')}
                  {issuedField('Weight (kg)', 'weight', 'number')}
                  {issuedField('Height (cm)', 'height', 'number')}
                  {issuedField('Temperature (°C)', 'temperature', 'number')}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Reason for edit (optional)</label>
                  <input
                    value={editReason}
                    onChange={(event) => setEditReason(event.target.value)}
                    placeholder="e.g., Corrected diagnosis after follow-up"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <button
                  onClick={handleSaveIssuedVisit}
                  disabled={isSavingVisit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSavingVisit ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            ) : (
              readOnlyVisit(context.visit)
            )}

            {context.editHistory.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Change history</p>
                <div className="space-y-2">
                  {context.editHistory.map((entry) => (
                    <div key={entry.id} className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                      <p className="font-medium text-slate-700">
                        {formatDateTime(entry.created_at)} · {entry.edited_by_email || 'Doctor'}
                      </p>
                      <p>
                        {Object.entries(entry.changes)
                          .map(([field, change]) => `${field.replace(/_/g, ' ')}: ${String(change.from ?? '—')} → ${String(change.to ?? '—')}`)
                          .join('; ')}
                      </p>
                      {entry.reason && <p className="text-slate-500">Reason: {entry.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Prescriptions</h2>
            {allPrescriptions.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No prescription was created for this consultation.
              </div>
            ) : (
              allPrescriptions.map(prescriptionReadOnly)
            )}
          </div>

          {replacementSource && (
            <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 space-y-3">
              <h2 className="text-lg font-semibold text-slate-800">Replacement prescription</h2>
              <p className="text-sm text-slate-500">
                The voided prescription stays in the record. This replacement is issued as a new prescription.
              </p>
              <div className="space-y-3">
                {replacementMeds.map((row, index) => (
                  <div key={row.key} className="rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">Medication {index + 1}</p>
                      <button
                        onClick={() => setReplacementMeds((rows) => rows.filter((item) => item.key !== row.key))}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(
                        [
                          ['medicationName', 'Medication name'],
                          ['dosage', 'Dosage'],
                          ['frequency', 'Frequency'],
                          ['duration', 'Duration'],
                          ['quantity', 'Quantity'],
                          ['instructions', 'Instructions'],
                        ] as const
                      ).map(([field, placeholder]) => (
                        <input
                          key={field}
                          value={row[field]}
                          onChange={(event) =>
                            setReplacementMeds((rows) =>
                              rows.map((item) => (item.key === row.key ? { ...item, [field]: event.target.value } : item))
                            )
                          }
                          placeholder={placeholder}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setReplacementMeds((rows) => [...rows, emptyMedicationRow()])}
                className="text-sm text-blue-600 font-medium hover:underline"
              >
                + Add medication
              </button>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Notes for patient</label>
                <textarea
                  rows={2}
                  value={replacementNotes}
                  onChange={(event) => setReplacementNotes(event.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={submitReplacement}
                  disabled={isIssuingReplacement || hasActivePrescription}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isIssuingReplacement ? 'Issuing…' : 'Issue replacement'}
                </button>
                <button
                  onClick={() => setReplacementSource(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => router.push('/doctor/dashboard')}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to Dashboard
            </button>
            {allPrescriptions.find((prescription) => prescription.status === 'ISSUED') && (
              <button
                onClick={() => {
                  const active = allPrescriptions.find((prescription) => prescription.status === 'ISSUED');
                  if (active) void handlePdf(active);
                }}
                disabled={busyPdfId !== null}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {busyPdfId ? 'Preparing…' : 'Print / Download PDF'}
              </button>
            )}
          </div>
        </>
      )}

      {/* Void modal */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Void this prescription?</h3>
              <p className="text-sm text-slate-500 mt-1">
                The prescription stays visible as Voided. A reason is required.
              </p>
            </div>
            <textarea
              rows={3}
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="Reason for voiding"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setVoidTarget(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitVoid}
                disabled={isVoiding}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {isVoiding ? 'Voiding…' : 'Void prescription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
