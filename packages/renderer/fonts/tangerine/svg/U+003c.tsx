import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 301 1000">
  <path d="M 61.18 -137.95 L 79.3 -139.97 L 86.01 -139.29 L 98.09 -151.37 L 270.53 -206.39 L 281.94 -211.09 L 292 -217.8" fill="none" stroke="currentColor" strokeWidth="20.2" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="267.7" strokeDashoffset="267.7" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="267.7" to="0" dur="0.083s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 92.05 -149.36 L 86.68 -139.29 L 90.03 -132.58 L 92.72 -130.57 L 225.58 -70.18 L 233.63 -70.85" fill="none" stroke="currentColor" strokeWidth="23.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="200.2" strokeDashoffset="200.2" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.233s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="200.2" to="0" dur="0.059s" begin="0.233s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
