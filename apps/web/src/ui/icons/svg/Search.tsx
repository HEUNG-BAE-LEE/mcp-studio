import type { SVGProps } from 'react';
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgSearch = ({ title, titleId, ...props }: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 18"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <circle cx={8} cy={8} r={5.4} stroke="currentColor" strokeWidth={1.5} />
    <path stroke="currentColor" strokeLinecap="round" strokeWidth={1.5} d="M12.1 12.1 16 16" />
  </svg>
);
export default SvgSearch;
