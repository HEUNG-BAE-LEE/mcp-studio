import type { SVGProps } from 'react';
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgIllustDatabase = ({ title, titleId, ...props }: SVGProps<SVGSVGElement> & SVGRProps) => (
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
    <ellipse cx={30} cy={14} rx={20} ry={7} />
    <path d="M10 14 v34 c0 3.9 9 7 20 7 s20 -3.1 20 -7 v-34" />
    <path
      d="M10 31 c0 3.9 9 7 20 7 s20 -3.1 20 -7"
      style={{
        opacity: 0.55,
      }}
    />
    <path
      d="M58 34 h16"
      style={{
        opacity: 0.45,
      }}
    />
    <path
      d="M78 30 l7 4 -7 4"
      style={{
        opacity: 0.45,
      }}
    />
    <path d="M92 8 h44 a4 4 0 0 1 4 4 v46 a4 4 0 0 1 -4 4 h-44 a4 4 0 0 1 -4 -4 v-46 a4 4 0 0 1 4 -4 z" />
    <path
      d="M88 22 h52"
      style={{
        opacity: 0.7,
      }}
    />
    <path
      d="M114 22 v40"
      style={{
        opacity: 0.45,
      }}
    />
    <path
      d="M88 36 h52 M88 49 h52"
      style={{
        opacity: 0.35,
      }}
    />
  </svg>
);
export default SvgIllustDatabase;
