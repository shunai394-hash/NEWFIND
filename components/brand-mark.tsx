import { useId } from "react";

type BrandMarkProps = {
  className?: string;
  title?: string;
};

export function BrandMark({ className = "h-7 w-7", title }: BrandMarkProps) {
  const clipId = `newfind-mark-${useId().replace(/:/g, "")}`;

  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" fill="#111111" />
      <defs>
        <clipPath id={clipId}>
          <circle cx="11.8" cy="13.58" r="8.15" />
        </clipPath>
      </defs>
      <circle
        cx="20.2"
        cy="18.43"
        r="8.15"
        fill="#C8FF00"
        clipPath={`url(#${clipId})`}
      />
      <circle
        cx="11.8"
        cy="13.58"
        r="8.15"
        fill="none"
        stroke="#C8FF00"
        strokeWidth="2.4"
      />
      <circle
        cx="20.2"
        cy="18.43"
        r="8.15"
        fill="none"
        stroke="#C8FF00"
        strokeWidth="2.4"
      />
    </svg>
  );
}
