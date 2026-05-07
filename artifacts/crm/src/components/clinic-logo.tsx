interface ClinicLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "full" | "compact";
}

export default function ClinicLogo({ size = "md", variant = "full" }: ClinicLogoProps) {
  if (variant === "compact") {
    const px = size === "sm" ? 28 : size === "md" ? 34 : 42;
    return (
      <svg width={px} height={px} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="url(#logoGrad)" opacity="0.15" />
        <text x="50%" y="56%" dominantBaseline="middle" textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontWeight="800" fontSize="16" fill="url(#logoGrad)">DF</text>
      </svg>
    );
  }

  const titleSize = size === "sm" ? "text-lg" : size === "md" ? "text-xl" : "text-3xl";
  const subSize = size === "sm" ? "text-[9px]" : size === "md" ? "text-[10px]" : "text-sm";
  const emojiSize = size === "sm" ? "text-base" : size === "md" ? "text-xl" : "text-3xl";

  return (
    <div className="flex items-center gap-2 select-none">
      <span className={`${emojiSize} leading-none`} role="img" aria-label="muela">🦷</span>
      <div className="flex flex-col leading-tight">
        <span
          className={`${titleSize} font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-400 bg-clip-text text-transparent`}
          style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
        >
          Dientes Fijos
        </span>
        <span className={`${subSize} font-bold tracking-[0.18em] uppercase text-teal-400/80`}>
          Medellín
        </span>
      </div>
    </div>
  );
}
