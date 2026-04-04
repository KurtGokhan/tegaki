import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -1875 800 2790">
  <path d="M 410.32 -1037.92 L 605.52 -720.46 L 611.95 -690.43 L 607.66 -679.71 L 163.65 -336.51" fill="none" stroke="currentColor" strokeWidth="56.0" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="1032.2" strokeDashoffset="1032.2" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="1032.2" to="0" dur="0.325s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
