'use client';

import { useEffect, useState } from 'react';
import { doctorApi, Prescription, PrescriptionItem, Visit, Patient } from '@/lib/api/doctorApi';

export default function DoctorPrescriptions() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);

  const [createFormData, setCreateFormData] = useState({
    patientId: '',
    visitId: '',
    notes: '',
    items: [{ medicationName: '', dosage: '', frequency: '', duration: '', instructions: '' }],
  });

  useEffect(() => {
    fetchDoctorProfile();
  }, []);

  const fetchDoctorProfile = async () => {
    try {
      const response = await doctorApi.getProfile();
      if (response.success && response.data) {
        setDoctorId(response.data.id);
        fetchPrescriptions();
        fetchPatients();
      } else {
        setError(response.error || 'Failed to fetch doctor profile');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Network error occurred');
      setIsLoading(false);
    }
  };

  const fetchPrescriptions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await doctorApi.getProfile();
      if (response.success && response.data) {
        const doctorId = response.data.id;
        const patientsResponse = await doctorApi.getPatients(doctorId);

        if (patientsResponse.success && patientsResponse.data) {
          const allPrescriptions: Prescription[] = [];
          for (const patient of patientsResponse.data) {
            const prescriptionsResponse = await doctorApi.getPatientPrescriptions(patient.id);
            if (prescriptionsResponse.success && prescriptionsResponse.data) {
              allPrescriptions.push(...prescriptionsResponse.data);
            }
          }
          setPrescriptions(allPrescriptions);
        }
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await doctorApi.getProfile();
      if (response.success && response.data) {
        const doctorId = response.data.id;
        const patientsResponse = await doctorApi.getPatients(doctorId);

        if (patientsResponse.success && patientsResponse.data) {
          setPatients(patientsResponse.data);
        }
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  const fetchPatientVisits = async (patientId: string) => {
    try {
      const visitsResponse = await doctorApi.getPatientVisits(patientId);
      if (visitsResponse.success && visitsResponse.data) {
        setVisits(visitsResponse.data);
      }
    } catch (err) {
      console.error('Error fetching visits:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleAddItem = () => {
    setCreateFormData({
      ...createFormData,
      items: [...createFormData.items, { medicationName: '', dosage: '', frequency: '', duration: '', instructions: '' }],
    });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = createFormData.items.filter((_, i) => i !== index);
    setCreateFormData({ ...createFormData, items: newItems });
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...createFormData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setCreateFormData({ ...createFormData, items: newItems });
  };

  const handlePatientChange = (patientId: string) => {
    setCreateFormData({
      ...createFormData,
      patientId,
      visitId: '',
    });
    if (patientId) {
      fetchPatientVisits(patientId);
    } else {
      setVisits([]);
    }
  };

  const handleCreatePrescription = async () => {
    if (!createFormData.patientId) {
      setCreateError('Please select a patient');
      return;
    }
    if (!createFormData.visitId) {
      setCreateError('Please select a visit');
      return;
    }

    const validItems = createFormData.items.filter(item => item.medicationName.trim());
    if (validItems.length === 0) {
      setCreateError('At least one medication is required');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await doctorApi.createPrescription({
        visitId: createFormData.visitId,
        items: validItems,
        notes: createFormData.notes || undefined,
      });

      if (response.success) {
        setShowCreateModal(false);
        setCreateFormData({
          patientId: '',
          visitId: '',
          notes: '',
          items: [{ medicationName: '', dosage: '', frequency: '', duration: '', instructions: '' }],
        });
        setVisits([]);
        fetchPrescriptions();
      } else {
        setCreateError(response.error || 'Failed to create prescription');
      }
    } catch (err) {
      setCreateError('Network error occurred');
    } finally {
      setIsCreating(false);
    }
  };

  const handleViewPrescription = async (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setShowViewModal(true);
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

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      return `${patient.first_name} ${patient.last_name}`;
    }
    return 'Unknown Patient';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Prescriptions</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 font-medium flex items-center gap-2"
          >
            <span className="material-symbols-outlined">add</span>
            Create Prescription
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-slate-600">Loading prescriptions...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchPrescriptions}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-300">medication</span>
            <p className="mt-4 text-slate-600">No prescriptions found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {prescriptions.map((prescription) => (
              <div key={prescription.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                        {prescription.items?.length || 0} Medication{(prescription.items?.length || 0) !== 1 ? 's' : ''}
                      </span>
                      {prescription.has_pdf && (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                          PDF Available
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-slate-800">
                      {prescription.patient_first_name} {prescription.patient_last_name}
                    </h3>

                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="material-symbols-outlined text-lg">calendar_today</span>
                        <span>{formatDate(prescription.prescription_date)}</span>
                      </div>

                      {prescription.items && prescription.items.length > 0 && (
                        <div className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="material-symbols-outlined text-lg mt-0.5">medication</span>
                          <div className="flex-1">
                            {prescription.items.slice(0, 2).map((item, index) => (
                              <div key={index}>{item.medication_name}</div>
                            ))}
                            {prescription.items.length > 2 && (
                              <div className="text-slate-400">+{prescription.items.length - 2} more</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => handleViewPrescription(prescription)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
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
            ))}
          </div>
        )}
      </div>

      {/* Create Prescription Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">Create Prescription</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError(null);
                    setCreateFormData({
                      patientId: '',
                      visitId: '',
                      notes: '',
                      items: [{ medicationName: '', dosage: '', frequency: '', duration: '', instructions: '' }],
                    });
                    setVisits([]);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {createError && (
              <div className="p-4 bg-red-50 border border-red-200 mx-6 mt-4 rounded-lg">
                <p className="text-red-600 text-sm">{createError}</p>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-500 mb-1">Patient *</label>
                <select
                  value={createFormData.patientId}
                  onChange={(e) => handlePatientChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a patient</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Visit *</label>
                <select
                  value={createFormData.visitId}
                  onChange={(e) => setCreateFormData({ ...createFormData, visitId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!createFormData.patientId}
                >
                  <option value="">Select a visit</option>
                  {visits.map((visit) => (
                    <option key={visit.id} value={visit.id}>
                      {formatDate(visit.visit_date)} - {visit.reason_for_visit || 'No reason specified'}
                    </option>
                  ))}
                </select>
                {!createFormData.patientId && (
                  <p className="text-xs text-slate-400 mt-1">Please select a patient first</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-2">Medications *</label>
                {createFormData.items.map((item, index) => (
                  <div key={index} className="bg-slate-50 rounded-lg p-4 mb-3 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700">Medication {index + 1}</span>
                      {createFormData.items.length > 1 && (
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Medication Name *</label>
                        <input
                          type="text"
                          value={item.medicationName}
                          onChange={(e) => handleItemChange(index, 'medicationName', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="e.g., Amoxicillin 500mg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Dosage</label>
                        <input
                          type="text"
                          value={item.dosage}
                          onChange={(e) => handleItemChange(index, 'dosage', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="e.g., 1 tablet"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Frequency</label>
                        <input
                          type="text"
                          value={item.frequency}
                          onChange={(e) => handleItemChange(index, 'frequency', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="e.g., Twice daily"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Duration</label>
                        <input
                          type="text"
                          value={item.duration}
                          onChange={(e) => handleItemChange(index, 'duration', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="e.g., 7 days"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Instructions</label>
                        <input
                          type="text"
                          value={item.instructions}
                          onChange={(e) => handleItemChange(index, 'instructions', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="e.g., Take with food"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleAddItem}
                  className="mt-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-600"
                >
                  + Add Medication
                </button>
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Additional Notes</label>
                <textarea
                  value={createFormData.notes}
                  onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Any additional notes for the patient..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                  setCreateFormData({
                    patientId: '',
                    visitId: '',
                    notes: '',
                    items: [{ medicationName: '', dosage: '', frequency: '', duration: '', instructions: '' }],
                  });
                  setVisits([]);
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePrescription}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Prescription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Prescription Modal */}
      {showViewModal && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">Prescription Details</h2>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedPrescription(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Patient</label>
                  <p className="font-medium text-slate-800">
                    {selectedPrescription.patient_first_name} {selectedPrescription.patient_last_name}
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Date</label>
                  <p className="font-medium text-slate-800">{formatDate(selectedPrescription.prescription_date)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-2">Medications</label>
                <div className="space-y-3">
                  {selectedPrescription.items?.map((item, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <h4 className="font-medium text-slate-800 mb-2">{item.medication_name}</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                        {item.dosage && (
                          <div>
                            <span className="text-slate-500">Dosage:</span> {item.dosage}
                          </div>
                        )}
                        {item.frequency && (
                          <div>
                            <span className="text-slate-500">Frequency:</span> {item.frequency}
                          </div>
                        )}
                        {item.duration && (
                          <div>
                            <span className="text-slate-500">Duration:</span> {item.duration}
                          </div>
                        )}
                        {item.instructions && (
                          <div className="col-span-2">
                            <span className="text-slate-500">Instructions:</span> {item.instructions}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPrescription.notes && (
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Additional Notes</label>
                  <p className="text-slate-800">{selectedPrescription.notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              {selectedPrescription.has_pdf ? (
                <button
                  onClick={() => handleDownloadPdf(selectedPrescription.id)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">download</span>
                  Download PDF
                </button>
              ) : (
                <button
                  onClick={() => handleGeneratePdf(selectedPrescription.id)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">picture_as_pdf</span>
                  Generate PDF
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
