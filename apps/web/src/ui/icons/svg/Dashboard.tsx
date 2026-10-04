import type { SVGProps } from 'react';
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgDashboard = ({ title, titleId, ...props }: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 18"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <rect width={6} height={6} x={2.2} y={2.2} stroke="currentColor" strokeWidth={1.5} rx={1.4} />
    <rect width={6} height={6} x={9.8} y={2.2} stroke="currentColor" strokeWidth={1.5} rx={1.4} />
    <rect width={6} height={6} x={2.2} y={9.8} stroke="currentColor" strokeWidth={1.5} rx={1.4} />
    <rect width={6} height={6} x={9.8} y={9.8} stroke="currentColor" strokeWidth={1.5} rx={1.4} />
  </svg>
);
export default SvgDashboard;
