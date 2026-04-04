import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 135 1250">
  <path d="M -412.59 196.93 L -414.75 233.67 L -408.27 263.93 L -380.17 300.68 L -345.59 320.13 L -291.55 328.78 L -259.13 326.62 L -202.93 307.16 L -151.05 272.58 L -84.05 205.57 L -30.01 121.27 L 26.19 4.55 L 112.65 -218.08 L 145.07 -254.83 L 162.37 -265.63 L 183.98 -269.96" fill="none" stroke="currentColor" strokeWidth="28.7" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="1046.2" strokeDashoffset="1046.2" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="1046.2" to="0" dur="0.339s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 194.79 -406.13 L 203.43 -412.62" fill="none" stroke="currentColor" strokeWidth="49.3" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="60.1" strokeDashoffset="60.1" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.489s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="60.1" to="0" dur="0.004s" begin="0.489s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
