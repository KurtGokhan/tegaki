import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 356 1000">
  <path d="M -10.82 49.81 L 10 42.57 L 48.04 37.13 L 165.75 32.61 L 304.3 31.7" fill="none" stroke="currentColor" strokeWidth="15.2" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="332.0" strokeDashoffset="332.0" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="332.0" to="0" dur="0.106s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
