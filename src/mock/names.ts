/** Synthetic name pools. Combinations are random and not meant to be real people. */

export const FIRST_NAMES_F = ['Maya', 'Elena', 'Priya', 'Nora', 'Tessa', 'Lena', 'Ruth', 'Cora', 'Inez', 'Wren', 'Dara', 'Mina', 'Opal', 'Vera', 'Sana', 'Hana', 'Iris', 'Lola', 'Greta', 'Alma'] // prettier-ignore

export const FIRST_NAMES_M = ['Owen', 'Raul', 'Dev', 'Theo', 'Marek', 'Ivan', 'Felix', 'Omar', 'Hugo', 'Kenji', 'Silas', 'Anton', 'Rafi', 'Nico', 'Emil', 'Joel', 'Pavel', 'Amir', 'Leon', 'Dario'] // prettier-ignore

export const LAST_NAMES = ['Alder', 'Brandt', 'Calloway', 'Delmar', 'Eastman', 'Fairlie', 'Garnett', 'Holloway', 'Iverson', 'Jaspers', 'Kessler', 'Lindqvist', 'Marlow', 'Nakamura', 'Ostrow', 'Pellegrino', 'Quillen', 'Rasmussen', 'Sorensen', 'Tavares', 'Underhill', 'Varga', 'Whitlock', 'Yarrow', 'Zielinski', 'Abara', 'Bellamy', 'Corrigan', 'Dumont', 'Ellery'] // prettier-ignore

/**
 * Fixed names for the first two patients on the "Blood pressure above normal"
 * list (P004, P005). P048 takes the name and sex P005 would have had.
 */
export const DEMO_CAST: Record<string, { name: string; sex: 'F' | 'M' }> = {
  P004: { name: 'Orijeet Mukherjee', sex: 'M' },
  P005: { name: 'Molly Brandt', sex: 'F' },
  P048: { name: 'Anton Ostrow', sex: 'M' },
}

/** Time zones with the share of patients in each. */
export const TIME_ZONES: [string, number][] = [
  ['America/New_York', 0.4],
  ['America/Chicago', 0.3],
  ['America/Denver', 0.1],
  ['America/Los_Angeles', 0.2],
]
