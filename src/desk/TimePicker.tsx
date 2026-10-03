/** times of day a visitor can switch the room to; "Live" follows their own clock */
const TIMES = [
  { label: 'Live', hour: null },
  { label: 'Morning', hour: 7.5 },
  { label: 'Midday', hour: 13 },
  { label: 'Golden hour', hour: 18.75 },
  { label: 'Dusk', hour: 20.5 },
  { label: 'Night', hour: 23 },
] as const

/** the time of day the room starts at: ?hour=21 in the address, if it matches a choice */
export function startingTime(): number | null {
  try {
    const h = Number(new URLSearchParams(window.location.search).get('hour'))
    return TIMES.find((t) => t.hour === h)?.hour ?? null
  } catch {
    return null
  }
}

/** a small menu in the header for seeing the desk at another time of day */
export default function TimePicker({ value, onChange }: { value: number | null; onChange: (hour: number | null) => void }) {
  const night = value !== null && (value >= 20 || value < 6)
  return (
    <label className="dk-time" title="See the desk at another time of day">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        {night ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span className="dk-sr">Time of day</span>
      <select
        value={value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      >
        {TIMES.map((t) => (
          <option key={t.label} value={t.hour === null ? '' : String(t.hour)}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  )
}
