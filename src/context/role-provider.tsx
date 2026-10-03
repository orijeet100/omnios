import { createContext, useContext, useState, type ReactNode } from 'react'

export type Role = 'phm' | 'cm' | 'physician'

interface RoleContextType {
  role: Role
  setRole: (role: Role) => void
}

const RoleContext = createContext<RoleContextType>({
  role: 'phm',
  setRole: () => {},
})

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('phm')
  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  return useContext(RoleContext)
}

export const ROLE_LABELS: Record<Role, { label: string; color: string }> = {
  phm: { label: 'Population Health', color: 'bg-blue-100 text-blue-800' },
  cm: { label: 'Care Manager', color: 'bg-green-100 text-green-800' },
  physician: { label: 'Physician (EHR)', color: 'bg-purple-100 text-purple-800' },
}
