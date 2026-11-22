import PageTransition from '@/components/PageTransition';

export default function DoctorLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
