import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 326 1260">
  <path d="M 126.35 -207.89 L 145.51 -203.78 L 187.25 -203.78 L 230.35 -209.94 L 298.09 -214.04 L 308.36 -212.68 L 333.67 -205.15" fill="none" stroke="currentColor" strokeWidth="46.5" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="256.0" strokeDashoffset="256.0" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="256.0" to="0" dur="0.070s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
