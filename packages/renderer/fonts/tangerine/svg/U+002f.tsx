import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 210 1000">
  <path d="M -12.82 32.81 L 205.22 -352.94 L 367.35 -625.02" fill="none" stroke="currentColor" strokeWidth="19.8" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="779.6" strokeDashoffset="779.6" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="779.6" to="0" dur="0.253s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
