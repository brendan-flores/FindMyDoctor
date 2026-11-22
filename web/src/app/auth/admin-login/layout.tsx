import PageTransition from '@/components/PageTransition';

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
