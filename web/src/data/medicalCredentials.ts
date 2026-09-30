/**
 * Recognized physician credentials and suffixes commonly used in the Philippines.
 * These represent official board certifications, society fellowships, and academic degrees.
 * No invented credentials.
 */

export interface MedicalCredential {
  value: string;
  label: string;
  description: string;
}

export const MEDICAL_CREDENTIALS: MedicalCredential[] = [
  { value: 'MD', label: 'MD', description: 'Doctor of Medicine' },
  { value: 'FPCP', label: 'FPCP', description: 'Fellow, Philippine College of Physicians' },
  { value: 'DPCP', label: 'DPCP', description: 'Diplomate, Philippine College of Physicians' },
  { value: 'FPCS', label: 'FPCS', description: 'Fellow, Philippine College of Surgeons' },
  { value: 'FPSGS', label: 'FPSGS', description: 'Fellow, Philippine Society of General Surgeons' },
  { value: 'FPOGS', label: 'FPOGS', description: 'Fellow, Philippine Obstetrical & Gynecological Society' },
  { value: 'DPOGS', label: 'DPOGS', description: 'Diplomate, Philippine Obstetrical & Gynecological Society' },
  { value: 'FPPS', label: 'FPPS', description: 'Fellow, Philippine Pediatric Society' },
  { value: 'DPPS', label: 'DPPS', description: 'Diplomate, Philippine Pediatric Society' },
  { value: 'DPBO', label: 'DPBO', description: 'Diplomate, Philippine Board of Ophthalmology' },
  { value: 'FPAFP', label: 'FPAFP', description: 'Fellow, Philippine Academy of Family Physicians' },
  { value: 'DPAFP', label: 'DPAFP', description: 'Diplomate, Philippine Academy of Family Physicians' },
  { value: 'FPSO-HNS', label: 'FPSO-HNS', description: 'Fellow, Philippine Society of Otolaryngology - Head & Neck Surgery' },
  { value: 'FPSP', label: 'FPSP', description: 'Fellow, Philippine Society of Pathologists' },
  { value: 'FPCR', label: 'FPCR', description: 'Fellow, Philippine College of Radiology' },
  { value: 'DPBR', label: 'DPBR', description: 'Diplomate, Philippine Board of Radiology' },
  { value: 'FPBA', label: 'FPBA', description: 'Fellow, Philippine Board of Anesthesiology' },
  { value: 'DPBA', label: 'DPBA', description: 'Diplomate, Philippine Board of Anesthesiology' },
  { value: 'FPCC', label: 'FPCC', description: 'Fellow, Philippine College of Cardiology' },
  { value: 'FPRA', label: 'FPRA', description: 'Fellow, Philippine Rheumatology Association' },
  { value: 'FPUA', label: 'FPUA', description: 'Fellow, Philippine Urological Association' },
  { value: 'FPSN', label: 'FPSN', description: 'Fellow, Philippine Society of Nephrology' },
  { value: 'FPDS', label: 'FPDS', description: 'Fellow, Philippine Dermatological Society' },
  { value: 'DPDS', label: 'DPDS', description: 'Diplomate, Philippine Dermatological Society' },
  { value: 'FPNA', label: 'FPNA', description: 'Fellow, Philippine Neurological Association' },
  { value: 'FPOA', label: 'FPOA', description: 'Fellow, Philippine Orthopaedic Association' },
  { value: 'FPSMO', label: 'FPSMO', description: 'Fellow, Philippine Society of Medical Oncology' },
  { value: 'FPCGM', label: 'FPCGM', description: 'Fellow, Philippine College of Geriatric Medicine' },
  { value: 'FPCCM', label: 'FPCCM', description: 'Fellow, Philippine College of Chest Physicians' },
  { value: 'FACS', label: 'FACS', description: 'Fellow, American College of Surgeons' },
  { value: 'FACP', label: 'FACP', description: 'Fellow, American College of Physicians' },
  { value: 'FAAP', label: 'FAAP', description: 'Fellow, American Academy of Pediatrics' },
  { value: 'FACC', label: 'FACC', description: 'Fellow, American College of Cardiology' },
  { value: 'PhD', label: 'PhD', description: 'Doctor of Philosophy' },
  { value: 'MPH', label: 'MPH', description: 'Master of Public Health' },
  { value: 'MHA', label: 'MHA', description: 'Master in Health Administration' },
  { value: 'MS', label: 'MS', description: 'Master of Science' },
];
