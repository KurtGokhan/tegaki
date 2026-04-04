import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 162 1000">
  <path d="M 78.9 -645.44 L 78.9 241" fill="none" stroke="currentColor" strokeWidth="4.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="891.3" strokeDashoffset="891.3" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="891.3" to="0" dur="0.295s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
