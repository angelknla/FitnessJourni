/**
 * Geometric icons rather than text glyphs. A "+" or "×" character sits off-centre
 * inside a centred box because its own font metrics — not the box — decide where
 * the ink lands. A path drawn symmetrically in a square viewBox cannot.
 */
interface IconProps {
  size?: number;
}

export const PlusIcon = ({ size = 16 }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M8 3.25v9.5M3.25 8h9.5" />
  </svg>
);

export const CrossIcon = ({ size = 16 }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" />
  </svg>
);

export const PencilIcon = ({ size = 15 }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M11.1 2.4l2.5 2.5-7.4 7.4-3.1.6.6-3.1z" />
    <path d="M10 3.5l2.5 2.5" />
  </svg>
);

export const ArrowLeftIcon = ({ size = 15 }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M9.5 3.5L5 8l4.5 4.5M5 8h7" />
  </svg>
);

export const EyeIcon = ({ size = 16 }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M1.5 8s2.4-4.2 6.5-4.2S14.5 8 14.5 8s-2.4 4.2-6.5 4.2S1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="1.9" />
  </svg>
);

export const EyeOffIcon = ({ size = 16 }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6.2 3.9A6.6 6.6 0 018 3.8c4.1 0 6.5 4.2 6.5 4.2a12 12 0 01-1.9 2.4M4 4.9A11.7 11.7 0 001.5 8S3.9 12.2 8 12.2c.8 0 1.5-.1 2.1-.4" />
    <path d="M2 2l12 12" />
  </svg>
);
