import type { SVGProps } from 'react';
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgIllustGit = ({ title, titleId, ...props }: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth={1.4}
    viewBox="0 0 150 74"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path d="M14 8 L14 66" />
    <path d="M14 26 C14 38, 34 30, 34 42 L34 58" />
    <path d="M14 44 C14 54, 30 50, 38 50" />
    <circle cx={14} cy={8} r={3.4} />
    <circle cx={14} cy={26} r={3.4} />
    <circle cx={14} cy={44} r={3.4} />
    <circle cx={14} cy={66} r={3.4} />
    <circle cx={34} cy={58} r={3.4} />
    <path
      d="M52 14 h38 a5 5 0 0 1 5 5 v10 a5 5 0 0 1 -5 5 h-38 a5 5 0 0 1 -5 -5 v-10 a5 5 0 0 1 5 -5 z"
      style={{
        opacity: 0.9,
      }}
    />
    <path
      d="M56 24 h14"
      style={{
        opacity: 0.55,
      }}
    />
    <path
      d="M52 44 h50 a5 5 0 0 1 5 5 v10 a5 5 0 0 1 -5 5 h-50 a5 5 0 0 1 -5 -5 v-10 a5 5 0 0 1 5 -5 z"
      style={{
        opacity: 0.9,
      }}
    />
    <path
      d="M56 54 h20"
      style={{
        opacity: 0.55,
      }}
    />
    <path
      d="M118 24 l10 0 M118 54 l10 0"
      style={{
        opacity: 0.4,
      }}
    />
    <path
      d="M132 20 l8 8 -8 8"
      style={{
        opacity: 0.4,
      }}
    />
  </svg>
);
export default SvgIllustGit;
