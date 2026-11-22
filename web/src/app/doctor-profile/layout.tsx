import PageTransition from '@/components/PageTransition';

export default function DoctorProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
