import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 149 1250">
  <path d="M 43.87 -16.84 L 59.24 -15.95 L 68.82 -15.95 L 71.94 -17.74 L 84.64 -19.29 L 108.92 -26.2" fill="none" stroke="currentColor" strokeWidth="29.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="96.5" strokeDashoffset="96.5" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="96.5" to="0" dur="0.022s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
