type BrandLogoProps = {
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
};

const sizes = {
  sm: "text-xl leading-none sm:text-2xl",
  md: "text-3xl leading-none sm:text-4xl",
  lg: "text-5xl leading-none sm:text-6xl md:text-7xl",
  hero: "text-5xl leading-none sm:text-7xl md:text-8xl lg:text-9xl",
};

export function BrandLogo({ size = "lg", className = "" }: BrandLogoProps) {
  return (
    <span
      className={`text-brand-name ${sizes[size]} ${className}`}
      aria-label="TerShare"
    >
      TerShare
    </span>
  );
}
