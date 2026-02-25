interface MobileVaultLogoProps {
  size?: number;
  className?: string;
}

export function MobileVaultLogo({ size = 48, className = "" }: MobileVaultLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 192 192"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle */}
      <circle cx="96" cy="96" r="96" fill="#7c3aed" />

      {/* Shield */}
      <g>
        {/* Shield outline - white border */}
        <path
          d="M 96 30 L 55 55 L 55 90 C 55 128 96 158 96 158 C 96 158 137 128 137 90 L 137 55 Z"
          fill="white"
          stroke="none"
        />

        {/* Top left purple section */}
        <path
          d="M 96 30 L 55 55 L 55 90 L 96 90 Z"
          fill="#7c3aed"
        />

        {/* Bottom right purple section */}
        <path
          d="M 96 90 L 137 90 L 137 55 L 96 30 Z"
          fill="#7c3aed"
        />
      </g>
    </svg>
  );
}
