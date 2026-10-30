'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doctorApi, Patient, Visit, Prescription } from '@/lib/api/doctorApi';

export default function PatientDetails() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditVisitModal, setShowEditVisitModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isEditingVisit, setIsEditingVisit] = useState(false);
  const [editVisitError, setEditVisitError] = useState<string | null>(null);
  const [showPatientNotified, setShowPatientNotified] = useState(false);

  const [visitFormData, setVisitFormData] = useState({
    reasonForVisit: '',
    diagnosis: '',
    notes: '',
    bloodPressure: '',
    weight: '',
    height: '',
    temperature: '',
  });

  useEffect(() => {
    fetchPatientData();
  }, [patientId]);

  const fetchPatientData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [patientResponse, visitsResponse, prescriptionsResponse] = await Promise.all([
        doctorApi.getPatientById(patientId),
        doctorApi.getPatientVisits(patientId),
        doctorApi.getPatientPrescriptions(patientId),
      ]);

      if (patientResponse.success && patientResponse.data) {
        setPatient(patientResponse.data);
      } else {
        setError(patientResponse.error || 'Failed to fetch patient details');
      }

      if (visitsResponse.success && visitsResponse.data) {
        setVisits(visitsResponse.data);
      }

      if (prescriptionsResponse.success && prescriptionsResponse.data) {
        setPrescriptions(prescriptionsResponse.data);
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getFullName = (patient: Patient) => {
    return `${patient.first_name} ${patient.middle_name ? patient.middle_name + ' ' : ''}${patient.last_name}`;
  };

  const handleEditVisit = (visit: Visit) => {
    setSelectedVisit(visit);
    setVisitFormData({
      reasonForVisit: visit.reason_for_visit || '',
      diagnosis: visit.diagnosis || '',
      notes: visit.notes || '',
      bloodPressure: visit.blood_pressure || '',
      weight: visit.weight ? String(visit.weight) : '',
      height: visit.height ? String(visit.height) : '',
      temperature: visit.temperature ? String(visit.temperature) : '',
    });
    setShowEditVisitModal(true);
    setEditVisitError(null);
  };

  const handleSaveVisit = async () => {
    if (!selectedVisit) return;

    setIsEditingVisit(true);
    setEditVisitError(null);

    try {
      const response = await doctorApi.recordVisit({
        appointmentId: selectedVisit.appointment_id || '',
        reasonForVisit: visitFormData.reasonForVisit || undefined,
        diagnosis: visitFormData.diagnosis || undefined,
        notes: visitFormData.notes || undefined,
        bloodPressure: visitFormData.bloodPressure || undefined,
        weight: visitFormData.weight ? parseFloat(visitFormData.weight) : undefined,
        height: visitFormData.height ? parseFloat(visitFormData.height) : undefined,
        temperature: visitFormData.temperature ? parseFloat(visitFormData.temperature) : undefined,
      });

      if (response.success) {
        setShowEditVisitModal(false);
        setSelectedVisit(null);
        setVisitFormData({
          reasonForVisit: '',
          diagnosis: '',
          notes: '',
          bloodPressure: '',
          weight: '',
          height: '',
          temperature: '',
        });
        // Refresh visits
        const visitsResponse = await doctorApi.getPatientVisits(patientId);
        if (visitsResponse.success && visitsResponse.data) {
          setVisits(visitsResponse.data);
        }
      } else {
        setEditVisitError(response.error || 'Failed to update visit');
      }
    } catch (err) {
      setEditVisitError('Network error occurred');
    } finally {
      setIsEditingVisit(false);
    }
  };

  const handleGeneratePdf = async (prescriptionId: string) => {
    try {
      const response = await doctorApi.generatePrescriptionPdf(prescriptionId);
      if (response.success && response.data?.signedUrl) {
        window.open(response.data.signedUrl, '_blank');
      } else {
        alert(response.error || 'Failed to generate PDF');
      }
    } catch (err) {
      alert('Network error occurred');
    }
  };

  const handleDownloadPdf = async (prescriptionId: string) => {
    try {
      const response = await doctorApi.getPrescriptionPdfUrl(prescriptionId);
      if (response.success && response.data?.signedUrl) {
        window.open(response.data.signedUrl, '_blank');
      } else {
        alert(response.error || 'Failed to get PDF URL');
      }
    } catch (err) {
      alert('Network error occurred');
    }
  };

  const showPatientNotifiedConfirmation = () => {
    setShowPatientNotified(true);
    setTimeout(() => setShowPatientNotified(false), 3000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-slate-600">Loading patient details...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
          <p className="text-red-600">{error || 'Patient not found'}</p>
          <button
            onClick={() => router.push('/doctor/patients')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Patients
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showPatientNotified && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 transition-opacity duration-300">
          <span className="material-symbols-outlined text-emerald-600">check_circle</span>
          <span className="text-emerald-800 font-medium">Patient notified of new prescription</span>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/doctor/patients')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{getFullName(patient)}</h1>
          <p className="text-slate-500">Patient Details</p>
        </div>
      </div>

      {/* Patient Information */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Patient Information</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-slate-500 mb-1">Full Name</label>
              <p className="font-medium text-slate-800">{getFullName(patient)}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Date of Birth</label>
              <p className="font-medium text-slate-800">{formatDate(patient.date_of_birth)}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Sex</label>
              <p className="font-medium text-slate-800">{patient.sex || 'Not specified'}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Phone</label>
              <p className="font-medium text-slate-800">{patient.phone || 'Not specified'}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Email</label>
              <p className="font-medium text-slate-800">{patient.email || 'Not specified'}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Address</label>
              <p className="font-medium text-slate-800">{patient.address || 'Not specified'}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Emergency Contact</label>
              <p className="font-medium text-slate-800">
                {patient.emergency_contact_name || 'Not specified'}
                {patient.emergency_contact_phone && ` (${patient.emergency_contact_phone})`}
              </p>
            </div>
          </div>

          {(patient.medical_history || patient.allergies || patient.current_medications) && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-500 mb-3">Medical Information</h3>
              <div className="space-y-3">
                {patient.medical_history && (
                  <div>
                    <label className="block text-sm text-slate-500 mb-1">Medical History</label>
                    <p className="text-slate-800">{patient.medical_history}</p>
                  </div>
                )}
                {patient.allergies && (
                  <div>
                    <label className="block text-sm text-slate-500 mb-1">Allergies</label>
                    <p className="text-slate-800">{patient.allergies}</p>
                  </div>
                )}
                {patient.current_medications && (
                  <div>
                    <label className="block text-sm text-slate-500 mb-1">Current Medications</label>
                    <p className="text-slate-800">{patient.current_medications}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Visit History */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Visit History</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {visits.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-6xl text-slate-300">history</span>
              <p className="mt-4 text-slate-600">No visit history found</p>
            </div>
          ) : (
            visits.map((visit) => (
              <div key={visit.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-slate-800">{formatDate(visit.visit_date)}</span>
                    </div>
                    {visit.reason_for_visit && (
                      <p className="text-sm text-slate-600 mb-1">
                        <span className="font-medium">Reason:</span> {visit.reason_for_visit}
                      </p>
                    )}
                    {visit.diagnosis && (
                      <p className="text-sm text-slate-600 mb-1">
                        <span className="font-medium">Diagnosis:</span> {visit.diagnosis}
                      </p>
                    )}
                    {visit.notes && (
                      <p className="text-sm text-slate-600 mb-1">
                        <span className="font-medium">Notes:</span> {visit.notes}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
                      {visit.blood_pressure && (
                        <span><span className="font-medium">BP:</span> {visit.blood_pressure}</span>
                      )}
                      {visit.weight && (
                        <span><span className="font-medium">Weight:</span> {visit.weight}kg</span>
                      )}
                      {visit.height && (
                        <span><span className="font-medium">Height:</span> {visit.height}cm</span>
                      )}
                      {visit.temperature && (
                        <span><span className="font-medium">Temp:</span> {visit.temperature}°C</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEditVisit(visit)}
                    className="ml-4 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Visit"
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Prescriptions */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Prescriptions</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {prescriptions.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-6xl text-slate-300">medication</span>
              <p className="mt-4 text-slate-600">No prescriptions found</p>
            </div>
          ) : (
            prescriptions.map((prescription) => (
              <div key={prescription.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-slate-800">{formatDate(prescription.prescription_date)}</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {prescription.items?.length || 0} Medication{(prescription.items?.length || 0) !== 1 ? 's' : ''}
                      </span>
                      {prescription.has_pdf && (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-medium">
                          PDF Available
                        </span>
                      )}
                    </div>
                    {prescription.items && prescription.items.length > 0 && (
                      <div className="space-y-1">
                        {prescription.items.slice(0, 2).map((item, index) => (
                          <p key={index} className="text-sm text-slate-600">
                            • {item.medication_name}
                          </p>
                        ))}
                        {prescription.items.length > 2 && (
                          <p className="text-sm text-slate-400">+{prescription.items.length - 2} more</p>
                        )}
                      </div>
                    )}
                    {prescription.notes && (
                      <p className="text-sm text-slate-600 mt-2">
                        <span className="font-medium">Notes:</span> {prescription.notes}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex gap-2">
                    {prescription.has_pdf ? (
                      <button
                        onClick={() => handleDownloadPdf(prescription.id)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Download PDF"
                      >
                        <span className="material-symbols-outlined">download</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleGeneratePdf(prescription.id)}
                        className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Generate PDF"
                      >
                        <span className="material-symbols-outlined">picture_as_pdf</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Visit Modal */}
      {showEditVisitModal && selectedVisit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Edit Visit</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {formatDate(selectedVisit.visit_date)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowEditVisitModal(false);
                    setSelectedVisit(null);
                    setEditVisitError(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {editVisitError && (
              <div className="p-4 bg-red-50 border border-red-200 mx-6 mt-4 rounded-lg">
                <p className="text-red-600 text-sm">{editVisitError}</p>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-500 mb-1">Reason for Visit</label>
                <input
                  type="text"
                  value={visitFormData.reasonForVisit}
                  onChange={(e) => setVisitFormData({ ...visitFormData, reasonForVisit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Acute respiratory infection"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Diagnosis</label>
                <input
                  type="text"
                  value={visitFormData.diagnosis}
                  onChange={(e) => setVisitFormData({ ...visitFormData, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Upper respiratory tract infection"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Notes</label>
                <textarea
                  value={visitFormData.notes}
                  onChange={(e) => setVisitFormData({ ...visitFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Clinical notes..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Blood Pressure</label>
                  <input
                    type="text"
                    value={visitFormData.bloodPressure}
                    onChange={(e) => setVisitFormData({ ...visitFormData, bloodPressure: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 120/80"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={visitFormData.weight}
                    onChange={(e) => setVisitFormData({ ...visitFormData, weight: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 70"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={visitFormData.height}
                    onChange={(e) => setVisitFormData({ ...visitFormData, height: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 170"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Temperature (°C)</label>
                  <input
                    type="number"
                    value={visitFormData.temperature}
                    onChange={(e) => setVisitFormData({ ...visitFormData, temperature: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 37.5"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditVisitModal(false);
                  setSelectedVisit(null);
                  setEditVisitError(null);
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                disabled={isEditingVisit}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVisit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isEditingVisit}
              >
                {isEditingVisit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
