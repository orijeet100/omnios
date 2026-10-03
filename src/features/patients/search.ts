import { z } from 'zod'

/** `?patient=P004` opens that patient's modal, so it can be linked and closed with Back. */
export const patientSearchSchema = z.object({
  patient: z.string().optional().catch(undefined),
})
