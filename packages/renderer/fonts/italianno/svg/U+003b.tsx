import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 154 1250">
  <path d="M 73.83 -14.59 L 83.98 -16.85 L 96.38 -15.72 L 108.79 -11.21 L 115.55 -21.36 L 109.91 -10.08 L 103.15 32.76 L 94.13 51.93 L 82.85 67.72 L 36.62 115.08" fill="none" stroke="currentColor" strokeWidth="27.0" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="238.0" strokeDashoffset="238.0" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="238.0" to="0" dur="0.070s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 165.17 -268.3 L 176.44 -267.17 L 182.08 -270.56 L 196.74 -271.68 L 215.91 -277.32" fill="none" stroke="currentColor" strokeWidth="31.5" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="84.1" strokeDashoffset="84.1" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.220s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="84.1" to="0" dur="0.018s" begin="0.220s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
