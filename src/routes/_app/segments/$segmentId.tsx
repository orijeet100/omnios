import { createFileRoute } from '@tanstack/react-router'
import { SegmentPage } from '@/features/dashboard/segment-page'
import { patientSearchSchema } from '@/features/patients/search'

export const Route = createFileRoute('/_app/segments/$segmentId')({
  validateSearch: patientSearchSchema,
  component: SegmentPage,
})
