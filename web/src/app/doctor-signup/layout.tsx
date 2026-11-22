import PageTransition from '@/components/PageTransition';

export default function DoctorSignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
