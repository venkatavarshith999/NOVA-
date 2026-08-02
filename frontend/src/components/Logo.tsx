export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="novaGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="6" r="3" fill="url(#novaGrad)" />
      <circle cx="6" cy="22" r="2.5" fill="#22d3ee" />
      <circle cx="26" cy="22" r="2.5" fill="#22d3ee" />
      <circle cx="16" cy="16" r="3.5" fill="url(#novaGrad)" />
      <path d="M16 9L16 12.5M13.5 18L8 21M18.5 18L24 21" stroke="url(#novaGrad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
