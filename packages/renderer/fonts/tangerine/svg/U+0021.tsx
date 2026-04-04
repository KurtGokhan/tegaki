import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 189 1000">
  <path d="M 298.97 -524.42 L 263.3 -475.37 L 215.74 -349.03 L 122.1 -134.99" fill="none" stroke="currentColor" strokeWidth="28.5" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="457.8" strokeDashoffset="457.8" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="457.8" to="0" dur="0.143s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 71.56 -20.54 L 95.34 -48.78" fill="none" stroke="currentColor" strokeWidth="34.2" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="71.1" strokeDashoffset="71.1" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.293s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="71.1" to="0" dur="0.012s" begin="0.293s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
