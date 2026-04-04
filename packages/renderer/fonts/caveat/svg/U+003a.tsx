import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 198 1260">
  <path d="M 134.8 -87.49 L 149.97 -97.61" fill="none" stroke="currentColor" strokeWidth="85.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="104.1" strokeDashoffset="104.1" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="104.1" to="0" dur="0.006s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 203.07 -295.68 L 219.93 -307.48" fill="none" stroke="currentColor" strokeWidth="84.2" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="104.8" strokeDashoffset="104.8" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.156s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="104.8" to="0" dur="0.007s" begin="0.156s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
