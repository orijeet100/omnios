import { createFileRoute } from '@tanstack/react-router'
import { AllPatients } from '@/features/patients'
import { patientSearchSchema } from '@/features/patients/search'

export const Route = createFileRoute('/_app/patients')({
  validateSearch: patientSearchSchema,
  component: AllPatients,
})
