import type { SVGProps } from 'react';
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgSidebarCollapse = ({ title, titleId, ...props }: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 18"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <rect width={14} height={12} x={2} y={3} stroke="currentColor" strokeWidth={1.5} rx={2.4} />
    <path stroke="currentColor" strokeWidth={1.5} d="M7 3v12" />
  </svg>
);
export default SvgSidebarCollapse;
