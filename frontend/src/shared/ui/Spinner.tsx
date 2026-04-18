interface SpinnerProps {
  size?: number;
  color?: string;
}

/**
 * Inline-спиннер. Размер задаётся числом (px).
 * Использует CSS-анимацию `spin` — должна быть определена в app.css (есть там как `.loading`).
 */
export function Spinner({ size = 20, color = 'currentColor' }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="3" strokeOpacity="0.15" />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </svg>
  );
}
