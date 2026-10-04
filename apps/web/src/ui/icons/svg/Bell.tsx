import type { SVGProps } from 'react';
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgBell = ({ title, titleId, ...props }: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 15 16"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      stroke="currentColor"
      strokeWidth={1.2}
      d="M3 6.5a4.5 4.5 0 1 1 9 0c0 2.2.5 3.3 1.2 4.1.4.4.1 1.1-.5 1.1H2.3c-.6 0-.9-.7-.5-1.1C2.5 9.8 3 8.7 3 6.5Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.2}
      d="M6 13.4a1.7 1.7 0 0 0 3 0"
    />
  </svg>
);
export default SvgBell;
