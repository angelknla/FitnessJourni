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
