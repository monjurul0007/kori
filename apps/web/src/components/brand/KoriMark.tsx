import { useId } from "react";

/** The Coin K mark (docs/brand/kori-logo-coin-k.svg), drawn as shapes so it renders the same everywhere. */
export function KoriMark({ size = 32, className }: { size?: number; className?: string }) {
  const clip = useId();
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <clipPath id={clip}>
        <rect width="120" height="120" rx="30" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect width="120" height="120" fill="#2F3A99" />
        <rect x="31" y="26" width="17" height="68" rx="8.5" fill="#FFFFFF" />
        <path
          d="M50 62 L83 86"
          stroke="#FFFFFF"
          strokeWidth="17"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="77" cy="40" r="15.5" fill="#F2A93B" />
        <circle cx="77" cy="40" r="9" fill="none" stroke="#C47A10" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
