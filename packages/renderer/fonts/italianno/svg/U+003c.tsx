import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 293 1250">
  <path d="M 325.42 -369.16 L 311.47 -349.11 L 266.14 -313.37 L 193.79 -263.68 L 144.1 -233.17 L 130.15 -207.88 L 104 -207.88 L 130.15 -207.88 L 134.51 -200.91 L 193.79 -153.84 L 230.4 -117.22 L 246.96 -96.3 L 244.35 -73.64 L 239.99 -57.94" fill="none" stroke="currentColor" strokeWidth="33.3" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="544.2" strokeDashoffset="544.2" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="544.2" to="0" dur="0.170s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
