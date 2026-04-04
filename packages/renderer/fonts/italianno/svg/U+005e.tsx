import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 313 1250">
  <path d="M 91.57 -259.86 L 183.61 -322.9 L 206.31 -328.57 L 224.59 -311.55 L 251.7 -290.75 L 288.9 -265.53 L 304.66 -256.7" fill="none" stroke="currentColor" strokeWidth="23.0" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="280.1" strokeDashoffset="280.1" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="280.1" to="0" dur="0.086s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 215.77 -320.38 L 215.77 -319.75" fill="none" stroke="currentColor" strokeWidth="33.1" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="33.7" strokeDashoffset="33.7" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.236s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="33.7" to="0" dur="0.001s" begin="0.236s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
