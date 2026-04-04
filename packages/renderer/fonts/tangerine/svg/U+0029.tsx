import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 276 1000">
  <path d="M 220.31 -629.64 L 236.68 -574.4 L 242.82 -535.53 L 246.91 -425.04 L 236.68 -322.74 L 214.18 -216.35 L 183.49 -122.23 L 148.7 -48.58 L 99.6 27.12 L 75.05 57.81 L 34.13 96.69" fill="none" stroke="currentColor" strokeWidth="27.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="813.4" strokeDashoffset="813.4" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="813.4" to="0" dur="0.262s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
