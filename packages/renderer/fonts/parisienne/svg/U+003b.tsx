import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -1875 440 2790">
  <path d="M 1.32 114.94 L 67.49 75.24 L 116.01 26.72 L 129.24 -32.83 L 111.6 -63.71" fill="none" stroke="currentColor" strokeWidth="77.5" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="319.9" strokeDashoffset="319.9" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="319.9" to="0" dur="0.081s" begin="0.000s" fill="freeze"/>
  </path>
  <circle cx="365.23" cy="-590.83" r="38.8" fill="currentColor" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.231s" fill="freeze"/>
  </circle>
</svg>);
export default SvgComponent;
