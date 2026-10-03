/**
 * Placeholder portrait photos for the demo, from the public randomuser.me
 * portrait set (100 photos each for women and men). The same patient always
 * gets the same photo, and no two patients of the same sex share one. Real
 * patient photos replace these via `photoUrl` on `PatientAvatar`.
 */

type Sex = 'F' | 'M'

const PORTRAIT_URL = 'https://randomuser.me/api/portraits'
const PORTRAITS_PER_SEX = 100

/** Patient ids look like "P004"; the number picks the portrait. */
export function avatarFor(sex: Sex, patientId: string): string {
  const number = Number.parseInt(patientId.replace(/\D/g, ''), 10) || 0
  const folder = sex === 'F' ? 'women' : 'men'
  return `${PORTRAIT_URL}/${folder}/${number % PORTRAITS_PER_SEX}.jpg`
}
