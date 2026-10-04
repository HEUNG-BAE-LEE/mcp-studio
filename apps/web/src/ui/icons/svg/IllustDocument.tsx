import type { SVGProps } from 'react';
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgIllustDocument = ({ title, titleId, ...props }: SVGProps<SVGSVGElement> & SVGRProps) => (
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
    <path
      d="M22 4 h30 l12 12 v42 a4 4 0 0 1 -4 4 h-38 a4 4 0 0 1 -4 -4 v-50 a4 4 0 0 1 4 -4 z"
      style={{
        opacity: 0.35,
      }}
    />
    <path d="M14 12 h30 l12 12 v42 a4 4 0 0 1 -4 4 h-38 a4 4 0 0 1 -4 -4 v-50 a4 4 0 0 1 4 -4 z" />
    <path
      d="M44 12 v12 h12"
      style={{
        opacity: 0.7,
      }}
    />
    <path
      d="M22 36 h24 M22 46 h24 M22 56 h14"
      style={{
        opacity: 0.45,
      }}
    />
    <path
      d="M70 38 h14"
      style={{
        opacity: 0.45,
      }}
    />
    <path
      d="M88 34 l7 4 -7 4"
      style={{
        opacity: 0.45,
      }}
    />
    <path d="M104 14 h32 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 h-32 a4 4 0 0 1 -4 -4 v-8 a4 4 0 0 1 4 -4 z" />
    <path
      d="M104 32 h32 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 h-32 a4 4 0 0 1 -4 -4 v-8 a4 4 0 0 1 4 -4 z"
      style={{
        opacity: 0.7,
      }}
    />
    <path
      d="M104 50 h32 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 h-32 a4 4 0 0 1 -4 -4 v-8 a4 4 0 0 1 4 -4 z"
      style={{
        opacity: 0.4,
      }}
    />
  </svg>
);
export default SvgIllustDocument;
