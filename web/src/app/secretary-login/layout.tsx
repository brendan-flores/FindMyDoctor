import PageTransition from '@/components/PageTransition';

export default function SecretaryLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
