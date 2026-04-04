import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -1875 1024 2790">
  <path d="M 37.21 254.2 L 100.09 220.34 L 917.59 -1463.02" fill="none" stroke="currentColor" strokeWidth="58.0" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="2000.8" strokeDashoffset="2000.8" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="2000.8" to="0" dur="0.648s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
