import DeviceTrustCard from '@/components/auth/DeviceTrustCard';

export default function DoctorTrustDevicePage() {
  return (
    <DeviceTrustCard
      portalLabel="Doctor Portal"
      loginPath="/doctor-login"
      dashboardPath="/doctor/dashboard"
    />
  );
}
