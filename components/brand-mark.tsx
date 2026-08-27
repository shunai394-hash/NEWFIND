type BrandMarkProps = {
  className?: string;
  title?: string;
};

export function BrandMark({ className = "h-7 w-7", title }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" fill="#111111" />
      <path
        fill="#C8FF00"
        d="M6 26.5V5.5h6.5L20.1 18.6V5.5H26v21h-6.5L11.9 13.4v13.1H6z"
      />
    </svg>
  );
}
