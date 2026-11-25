'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doctorApi, Prescription, Patient } from '@/lib/api/doctorApi';
import { usePresence } from '@/hooks/usePresence';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function DoctorPrescriptions() {
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ title: string; message: string } | null>(null);
  const viewModalOpen = showViewModal && !!selectedPrescription;
  const viewModalPresent = usePresence(viewModalOpen);

  useEffect(() => {
    fetchDoctorProfile();
  }, []);

  const fetchDoctorProfile = async () => {
    try {
      const response = await doctorApi.getProfile();
      if (response.success && response.data) {
        fetchPrescriptions();
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
          setPatients(patientsResponse.data);
          const allPrescriptions: Prescription[] = [];
          for (const patient of patientsResponse.data) {
            const prescriptionsResponse = await doctorApi.getPatientPrescriptions(patient.id);
            if (prescriptionsResponse.success && prescriptionsResponse.data) {
              allPrescriptions.push(...prescriptionsResponse.data);
            }
          }
          allPrescriptions.sort(
            (a, b) => new Date(b.prescription_date).getTime() - new Date(a.prescription_date).getTime()
          );
          setPrescriptions(allPrescriptions);
        }
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
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

  const handleViewPrescription = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setShowViewModal(true);
  };

  const handleGeneratePdf = async (prescriptionId: string) => {
    try {
      const response = await doctorApi.generatePrescriptionPdf(prescriptionId);
      if (response.success && response.data?.signedUrl) {
        window.open(response.data.signedUrl, '_blank');
      } else {
        setInfoDialog({
          title: 'Unable to generate PDF',
          message: response.error || 'Failed to generate PDF',
        });
      }
    } catch (err) {
      setInfoDialog({ title: 'Network error', message: 'Network error occurred' });
    }
  };

  const handleDownloadPdf = async (prescriptionId: string) => {
    try {
      const response = await doctorApi.downloadPrescriptionPdf(prescriptionId);
      if (response.success && response.data && response.fileName) {
        const url = URL.createObjectURL(response.data);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = response.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setInfoDialog({
          title: 'Unable to download PDF',
          message: response.error || 'Failed to download PDF',
        });
      }
    } catch (err) {
      setInfoDialog({ title: 'Network error', message: 'Network error occurred' });
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
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Prescriptions</h1>
            <p className="text-primary-100 text-sm mt-1">
              Prescriptions are issued from a patient&apos;s consultation. Voided prescriptions stay visible for the record.
            </p>
          </div>
          <button
            onClick={() => router.push('/doctor/appointments')}
            className="px-4 py-2 bg-white text-primary-600 rounded-lg hover:bg-primary-50 font-medium flex items-center gap-2"
          >
            <span className="material-symbols-outlined">clinical_notes</span>
            Go to consultations
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-100">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-neutral-600">Loading prescriptions...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-error-600">{error}</p>
            <button
              onClick={fetchPrescriptions}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Retry
            </button>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-6xl text-neutral-300">medication</span>
            <p className="mt-4 text-neutral-600">No prescriptions found</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {prescriptions.map((prescription) => {
              const isVoided = prescription.status === 'VOIDED';
              return (
                <div key={prescription.id} className="p-6 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          isVoided ? 'bg-error-100 text-error-800' : 'bg-success-100 text-success-800'
                        }`}>
                          {isVoided ? 'Voided' : 'Issued'}
                        </span>
                        <span className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">
                          {prescription.items?.length || 0} Medication{(prescription.items?.length || 0) !== 1 ? 's' : ''}
                        </span>
                        {prescription.replaces_prescription_id && (
                          <span className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-sm font-medium">
                            Replacement
                          </span>
                        )}
                        {prescription.has_pdf && (
                          <span className="px-3 py-1 bg-success-50 text-success-700 rounded-full text-sm font-medium">
                            PDF Available
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold text-neutral-800">
                        {getPatientName(prescription.patient_id)}
                      </h3>

                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-sm text-neutral-600">
                          <span className="material-symbols-outlined text-lg">calendar_today</span>
                          <span>{formatDate(prescription.prescription_date)}</span>
                        </div>

                        {prescription.items && prescription.items.length > 0 && (
                          <div className="flex items-start gap-2 text-sm text-neutral-600">
                            <span className="material-symbols-outlined text-lg mt-0.5">medication</span>
                            <div className="flex-1">
                              {prescription.items.slice(0, 2).map((item, index) => (
                                <div key={index}>{item.medication_name}</div>
                              ))}
                              {prescription.items.length > 2 && (
                                <div className="text-neutral-400">+{prescription.items.length - 2} more</div>
                              )}
                            </div>
                          </div>
                        )}

                        {isVoided && prescription.void_reason && (
                          <p className="text-sm text-error-700 bg-error-50 rounded-lg px-3 py-2 mt-2">
                            Void reason: {prescription.void_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewPrescription(prescription)}
                        className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <span className="material-symbols-outlined">visibility</span>
                      </button>
                      {prescription.has_pdf ? (
                        <>
                          <button
                            onClick={() => handleDownloadPdf(prescription.id)}
                            className="p-2 text-neutral-400 hover:text-success-600 hover:bg-success-50 rounded-lg transition-colors"
                            title="Download PDF"
                          >
                            <span className="material-symbols-outlined">download</span>
                          </button>
                          <button
                            onClick={() => handleGeneratePdf(prescription.id)}
                            className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Regenerate PDF"
                          >
                            <span className="material-symbols-outlined">refresh</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleGeneratePdf(prescription.id)}
                          className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Generate PDF"
                        >
                          <span className="material-symbols-outlined">picture_as_pdf</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View Prescription Modal */}
      {viewModalPresent && selectedPrescription && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          data-state={viewModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            data-state={viewModalOpen ? 'open' : 'closed'}
          >
            <div className="p-6 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-800">Prescription Details</h2>
                  <p className="text-sm text-neutral-500 mt-1">
                    {selectedPrescription.status === 'VOIDED' ? 'Voided' : 'Issued'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                  }}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-500 mb-1">Patient</label>
                  <p className="font-medium text-neutral-800">
                    {getPatientName(selectedPrescription.patient_id)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-neutral-500 mb-1">Date</label>
                  <p className="font-medium text-neutral-800">{formatDate(selectedPrescription.prescription_date)}</p>
                </div>
              </div>

              {selectedPrescription.status === 'VOIDED' && selectedPrescription.void_reason && (
                <div className="bg-error-50 border border-error-200 rounded-lg p-3 text-sm text-error-700">
                  Void reason: {selectedPrescription.void_reason}
                </div>
              )}

              <div>
                <label className="block text-sm text-neutral-500 mb-2">Medications</label>
                <div className="space-y-3">
                  {selectedPrescription.items?.map((item, index) => (
                    <div key={index} className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                      <h4 className="font-medium text-neutral-800 mb-2">{item.medication_name}</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-neutral-600">
                        {item.dosage && (
                          <div>
                            <span className="text-neutral-500">Dosage:</span> {item.dosage}
                          </div>
                        )}
                        {item.frequency && (
                          <div>
                            <span className="text-neutral-500">Frequency:</span> {item.frequency}
                          </div>
                        )}
                        {item.duration && (
                          <div>
                            <span className="text-neutral-500">Duration:</span> {item.duration}
                          </div>
                        )}
                        {item.quantity !== null && item.quantity !== undefined && (
                          <div>
                            <span className="text-neutral-500">Quantity:</span> {item.quantity}
                          </div>
                        )}
                        {item.instructions && (
                          <div className="col-span-2">
                            <span className="text-neutral-500">Instructions:</span> {item.instructions}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPrescription.notes && (
                <div>
                  <label className="block text-sm text-neutral-500 mb-1">Additional Notes</label>
                  <p className="text-neutral-800">{selectedPrescription.notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-neutral-100 flex justify-end gap-3">
              {selectedPrescription.has_pdf ? (
                <>
                  <button
                    onClick={() => handleGeneratePdf(selectedPrescription.id)}
                    className="px-4 py-2 border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 flex items-center gap-2"
                    title="Regenerate PDF with latest details and signature"
                  >
                    <span className="material-symbols-outlined">refresh</span>
                    Regenerate PDF
                  </button>
                  <button
                    onClick={() => handleDownloadPdf(selectedPrescription.id)}
                    className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined">download</span>
                    Download PDF
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleGeneratePdf(selectedPrescription.id)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">picture_as_pdf</span>
                  Generate PDF
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={infoDialog !== null}
        mode="info"
        title={infoDialog?.title ?? ''}
        message={infoDialog?.message ?? ''}
        onConfirm={() => setInfoDialog(null)}
        onCancel={() => setInfoDialog(null)}
      />
    </div>
  );
}
