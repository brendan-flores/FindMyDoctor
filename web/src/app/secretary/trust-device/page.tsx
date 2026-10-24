import DeviceTrustCard from '@/components/auth/DeviceTrustCard';

export default function SecretaryTrustDevicePage() {
  return (
    <DeviceTrustCard
      portalLabel="Secretary Portal"
      loginPath="/secretary-login"
      dashboardPath="/secretary/dashboard"
    />
  );
}
