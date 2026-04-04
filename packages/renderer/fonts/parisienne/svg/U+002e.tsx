import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -1875 350 2790">
  <path d="M 92.6 -62.75 L 93 -62.75" fill="none" stroke="currentColor" strokeWidth="145.0" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="145.4" strokeDashoffset="145.4" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="145.4" to="0" dur="0.001s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
