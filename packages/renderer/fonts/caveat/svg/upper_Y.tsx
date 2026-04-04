import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 504 1260">
  <path d="M 252.76 21.87 L 273.34 -68.71 L 333.04 -256.05 L 343.34 -311.63 L 382.45 -326.04 L 415.39 -356.92 L 645.96 -610.13 L 652.13 -628.66" fill="none" stroke="currentColor" strokeWidth="61.8" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="856.7" strokeDashoffset="856.7" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="856.7" to="0" dur="0.265s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 267.17 -657.48 L 263.05 -540.14 L 275.4 -428.97 L 283.64 -396.03 L 304.22 -348.68 L 322.75 -326.04 L 345.4 -313.69" fill="none" stroke="currentColor" strokeWidth="59.3" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="429.2" strokeDashoffset="429.2" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.415s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="429.2" to="0" dur="0.123s" begin="0.415s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
