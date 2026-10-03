import { useQuery } from '@tanstack/react-query'
import { getApiAdapter } from '@/api'

/** Every patient sent to the physician so far. */
export function useNotifications() {
  const { data = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => [...getApiAdapter().listNotifications()],
    // The adapter mutates its notifications in place, so skip structural sharing.
    structuralSharing: false,
  })
  return data
}

/** True once the patient has been sent to the physician. */
export function useIsSent(patientId: string | undefined) {
  return useNotifications().some((n) => n.patient_id === patientId)
}
