import saccoLogoImg from "@assets/biashara-logo_1773421656531.png";

interface SaccoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-14 h-14",
  xl: "w-20 h-20",
};

export function SaccoLogo({ size = "md", className = "" }: SaccoLogoProps) {
  return (
    <img 
      src={saccoLogoImg} 
      alt="Biashara SACCO" 
      className={`${sizeMap[size]} object-contain ${className}`}
    />
  );
}

export { saccoLogoImg };
