import { useId } from "react";

type BrandMarkProps = {
  className?: string;
  title?: string;
};

/**
 * NEWFIND mark: two overlapping rings (new + find) whose second ring is a
 * discovery lens. Same geometry as the app icon (public/brand/app-icon.svg),
 * drawn flat so it stays crisp at 28px.
 */
export function BrandMark({ className = "h-7 w-7", title }: BrandMarkProps) {
  const id = useId().replace(/:/g, "");
  const ringClip = `newfind-ring-${id}`;
  const markMask = `newfind-mask-${id}`;

  return (
    <svg
      className={className}
      viewBox="0 0 1024 1024"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={ringClip}>
          <circle cx="392" cy="392" r="208" />
        </clipPath>
        <mask id={markMask} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
          <rect width="1024" height="1024" fill="#000" />
          <g fill="none" stroke="#fff" strokeLinecap="round">
            <circle cx="392" cy="392" r="208" strokeWidth="58" />
            <circle cx="572" cy="572" r="208" strokeWidth="58" />
            <path d="M734 734 L842 842" strokeWidth="96" />
          </g>
          <circle cx="572" cy="572" r="208" fill="#fff" clipPath={`url(#${ringClip})`} />
          <path d="M482 404 L500 464 L560 482 L500 500 L482 560 L464 500 L404 482 L464 464 Z" fill="#000" />
        </mask>
      </defs>
      <rect width="1024" height="1024" fill="#111111" />
      <rect width="1024" height="1024" fill="#C6FF00" mask={`url(#${markMask})`} transform="translate(-6 -6)" />
    </svg>
  );
}
