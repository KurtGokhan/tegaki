import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 301 1000">
  <path d="M 73.84 -176.19 L 84.67 -179.58 L 100.24 -181.61 L 161.83 -182.96 L 256.59 -182.28 L 280.28 -187.02" fill="none" stroke="currentColor" strokeWidth="17.4" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="225.0" strokeDashoffset="225.0" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="225.0" to="0" dur="0.069s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 48.8 -102.42 L 60.98 -106.48 L 82.64 -109.18 L 233.58 -109.18 L 255.24 -113.92" fill="none" stroke="currentColor" strokeWidth="16.8" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="224.6" strokeDashoffset="224.6" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.219s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="224.6" to="0" dur="0.069s" begin="0.219s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
