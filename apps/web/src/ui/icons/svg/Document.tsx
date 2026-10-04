import type { SVGProps } from 'react';
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgDocument = ({ title, titleId, ...props }: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 18"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <rect
      width={11.6}
      height={13.2}
      x={3.2}
      y={2.4}
      stroke="currentColor"
      strokeWidth={1.5}
      rx={1.9}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M6.2 6.6h5.6M6.2 10h3.8"
    />
  </svg>
);
export default SvgDocument;
