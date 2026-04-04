import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 450 1260">
  <path d="M 194.77 -345.11 L 381.59 -474.33 L 428.29 -485.23 L 439.19 -493.01 L 454.76 -513.25 L 434.52 -486.78 L 437.64 -477.44 L 426.74 -415.17 L 362.91 -209.66 L 331.77 -120.92 L 308.42 -29.07 L 313.09 -11.94" fill="none" stroke="currentColor" strokeWidth="67.5" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="909.7" strokeDashoffset="909.7" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="909.7" to="0" dur="0.281s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
