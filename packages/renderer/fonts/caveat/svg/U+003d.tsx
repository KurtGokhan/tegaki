import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 446 1260">
  <path d="M 130.02 -162.67 L 145.98 -158.68 L 196.86 -158.68 L 257.73 -165.66 L 352.51 -169.66 L 387.43 -160.68" fill="none" stroke="currentColor" strokeWidth="45.2" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="304.8" strokeDashoffset="304.8" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="304.8" to="0" dur="0.087s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 182.9 -305.35 L 199.86 -300.36 L 248.75 -300.36 L 299.63 -306.35 L 407.39 -311.33 L 430.33 -307.34 L 443.31 -302.35" fill="none" stroke="currentColor" strokeWidth="45.0" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="307.9" strokeDashoffset="307.9" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.237s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="307.9" to="0" dur="0.088s" begin="0.237s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
