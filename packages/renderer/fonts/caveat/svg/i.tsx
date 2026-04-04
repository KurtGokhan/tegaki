import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 187 1260">
  <path d="M 182.42 -273.63 L 185.3 -260.7 L 145.07 -150.06 L 124.95 -82.52 L 123.51 -60.97 L 127.82 -40.85" fill="none" stroke="currentColor" strokeWidth="54.5" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="298.1" strokeDashoffset="298.1" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="298.1" to="0" dur="0.081s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 247.08 -502.09 L 247.08 -487.72 L 228.4 -463.29" fill="none" stroke="currentColor" strokeWidth="63.7" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="108.8" strokeDashoffset="108.8" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.231s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="108.8" to="0" dur="0.015s" begin="0.231s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
