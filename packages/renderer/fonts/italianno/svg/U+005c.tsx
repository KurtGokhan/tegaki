import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 498 1250">
  <path d="M 19.85 -593.98 L 41.12 -588.66 L 53.52 -578.03 L 87.19 -535.5 L 492.98 22.69" fill="none" stroke="currentColor" strokeWidth="39.5" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="822.1" strokeDashoffset="822.1" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="822.1" to="0" dur="0.261s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
