import dipIconUrl from '../../../../resources/icons/dip-icon.svg'

// Dip's icon. The SVG is drawn as a mask filled with the text colour, so it follows the
// light and dark themes like the emoji icons around it.
export function DipIcon(): React.JSX.Element {
  return (
    <span
      className="dip-icon"
      aria-hidden
      style={{ '--dip-icon': `url("${dipIconUrl}")` } as React.CSSProperties}
    />
  )
}
