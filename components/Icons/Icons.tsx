/**
 * Geometric icons rather than text glyphs. A "+" or "×" character sits off-centre
 * inside a centred box because its own font metrics — not the box — decide where
 * the ink lands. A path drawn symmetrically in a square viewBox cannot.
 */
interface IconProps {
  size?: number;
}

interface NavIconProps extends IconProps {
  children: React.ReactNode;
}

const NavIcon = ({ size = 20, children }: NavIconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const HomeIcon = ({ size }: IconProps) => (
  <NavIcon size={size}>
    <path d="M3.5 10.5 12 3l8.5 7.5" />
    <path d="M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6" />
  </NavIcon>
);

export const DumbbellIcon = ({ size }: IconProps) => (
  <NavIcon size={size}>
    <path d="M6.5 8v8M3.5 9.5v5M17.5 8v8M20.5 9.5v5M6.5 12h11" />
  </NavIcon>
);

export const RunningIcon = ({ size }: IconProps) => (
  <NavIcon size={size}>
    <circle cx="15.5" cy="4.5" r="1.5" />
    <path d="m13 8-3 4 3.5 2.5-2 5M13 8l3 3 3-1M10 12l-4 1" />
  </NavIcon>
);

export const LogsIcon = ({ size }: IconProps) => (
  <NavIcon size={size}>
    <path d="M6 3.5h12v17H6zM9 8h6M9 12h6M9 16h4" />
  </NavIcon>
);

export const CalendarIcon = ({ size }: IconProps) => (
  <NavIcon size={size}>
    <path d="M4 6.5h16v14H4zM8 3.5v6M16 3.5v6M4 10.5h16" />
  </NavIcon>
);

export const ResyncIcon = ({ size = 18 }: IconProps) => (
  <NavIcon size={size}>
    <path d="M20 6v5h-5" />
    <path d="M4 18v-5h5" />
    <path d="M6.1 8.5A7 7 0 0 1 18.7 7L20 11" />
    <path d="M17.9 15.5A7 7 0 0 1 5.3 17L4 13" />
  </NavIcon>
);

export const MessageIcon = ({ size }: IconProps) => (
  <NavIcon size={size}>
    <path d="M4 4.5h16v11H9l-5 4z" />
    <path d="M8 8.5h8M8 11.5h5" />
  </NavIcon>
);

export const SendIcon = ({ size = 18 }: IconProps) => (
  <NavIcon size={size}>
    <path d="m3.5 4 17 8-17 8 3-8z" />
    <path d="M6.5 12h14" />
  </NavIcon>
);

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

export const UploadIcon = ({ size = 18 }: IconProps) => (
  <svg
    viewBox="0 0 18 18"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M9 12.5v-9M5.5 7 9 3.5 12.5 7" />
    <path d="M3 11.5v3h12v-3" />
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

export const MoreIcon = ({ size = 16 }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="3" cy="8" r="1.15" />
    <circle cx="8" cy="8" r="1.15" />
    <circle cx="13" cy="8" r="1.15" />
  </svg>
);

export const ReactionIcon = ({ size = 16 }: IconProps) => (
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
    <circle cx="8" cy="8" r="6" />
    <path d="M5.5 6.5h.01M10.5 6.5h.01M5.5 9.5c.7.9 1.5 1.3 2.5 1.3s1.8-.4 2.5-1.3" />
    <path d="M13.5 2.5v3M12 4h3" />
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

export const ReplyIcon = ({ size = 16 }: IconProps) => (
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
    <path d="M6.5 3.5 3 7l3.5 3.5" />
    <path d="M3.5 7h4.25C10.9 7 13 8.7 13 12" />
  </svg>
);

export const ChevronLeftIcon = ({ size = 16 }: IconProps) => (
  <NavIcon size={size}>
    <path d="m14.5 5-7 7 7 7" />
  </NavIcon>
);

export const ChevronRightIcon = ({ size = 16 }: IconProps) => (
  <NavIcon size={size}>
    <path d="m9.5 5 7 7-7 7" />
  </NavIcon>
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

export const BinIcon = ({ size = 16 }: IconProps) => (
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
    {/* Lid, then body, then the two ribs — drawn symmetrically about x=8. */}
    <path d="M2.75 4.25h10.5M6.25 4.25V2.75h3.5v1.5" />
    <path d="M4 4.25l.6 8.4a.9.9 0 0 0 .9.85h5a.9.9 0 0 0 .9-.85l.6-8.4" />
    <path d="M6.75 6.75v4.5M9.25 6.75v4.5" />
  </svg>
);

/** Two figures — a group, not a single person, which is the whole distinction. */
export const GroupIcon = ({ size = 16 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
    <circle cx="9" cy="7" r="3.2" />
    <path d="M22 19v-1a4 4 0 0 0-3-3.87" />
    <path d="M16.5 4.2a3.2 3.2 0 0 1 0 5.6" />
  </svg>
);

/** Two arrows trading places — swapping which group you are in, not reloading. */
export const SwitchIcon = ({ size = 14 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M3 9h14" />
    <path d="M14 6l3 3-3 3" />
    <path d="M21 15H7" />
    <path d="M10 12l-3 3 3 3" />
  </svg>
);
