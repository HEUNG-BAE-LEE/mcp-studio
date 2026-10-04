import type { SVGProps } from 'react';
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgOntology = ({ title, titleId, ...props }: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 18"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <circle cx={13.4} cy={4.2} r={2.3} stroke="currentColor" strokeWidth={1.5} />
    <circle cx={4.6} cy={9} r={2.3} stroke="currentColor" strokeWidth={1.5} />
    <circle cx={13.4} cy={13.8} r={2.3} stroke="currentColor" strokeWidth={1.5} />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M6.7 7.8l4.6-2.5M6.7 10.2l4.6 2.5"
    />
  </svg>
);
export default SvgOntology;
