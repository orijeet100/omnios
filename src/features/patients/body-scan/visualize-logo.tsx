/**
 * The Visualize logo (purple on white). It blends into the page: multiply in
 * light mode removes the white; in dark mode the colours are inverted and
 * rotated back so the logo stays purple while the white becomes black.
 */
export function VisualizeLogo() {
  return (
    <img
      src='/images/visualize.jpg'
      alt='Visualize'
      className='h-7 w-auto mix-blend-multiply dark:mix-blend-screen dark:hue-rotate-180 dark:invert'
    />
  )
}
