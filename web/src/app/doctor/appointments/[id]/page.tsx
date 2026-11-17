'use client';

import { useParams } from 'next/navigation';
import ConsultationWorkspace from '@/components/consultation/ConsultationWorkspace';

export default function AppointmentDetailPage() {
  const params = useParams();
  const appointmentId = params.id as string;

  return <ConsultationWorkspace appointmentId={appointmentId} />;
}
