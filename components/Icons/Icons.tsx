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
