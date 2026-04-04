import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -1875 800 2790">
  <path d="M 721.58 -1037.92 L 286.15 -701.16 L 273.27 -681.85 L 277.57 -651.83 L 474.91 -336.51" fill="none" stroke="currentColor" strokeWidth="56.8" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="1032.7" strokeDashoffset="1032.7" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="1032.7" to="0" dur="0.325s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
