import type { SVGProps } from 'react';
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgDatabase = ({ title, titleId, ...props }: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 18"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <ellipse cx={9} cy={4.4} stroke="currentColor" strokeWidth={1.5} rx={5.8} ry={2.2} />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M3.2 4.4v9.2c0 1.2 2.6 2.2 5.8 2.2s5.8-1 5.8-2.2V4.4"
    />
    <path stroke="currentColor" strokeWidth={1.5} d="M3.2 9c0 1.2 2.6 2.2 5.8 2.2s5.8-1 5.8-2.2" />
  </svg>
);
export default SvgDatabase;
