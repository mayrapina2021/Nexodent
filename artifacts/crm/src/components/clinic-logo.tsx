interface ClinicLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "full" | "compact";
}

export default function ClinicLogo({ size = "md" }: ClinicLogoProps) {
  const height = size === "sm" ? 32 : size === "md" ? 44 : 72;
  
  return (
    <div className="flex items-center gap-2 select-none">
      <img 
        src="/logo.png" 
        alt="Nexodent" 
        style={{ height: `${height}px`, width: 'auto' }}
        className="object-contain drop-shadow-sm"
      />
    </div>
  );
}
