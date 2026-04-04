import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 330 1260">
  <path d="M 58.02 58.78 L 60.24 29.84 L 78.05 -12.47 L 238.36 -315.27 L 320.74 -453.31 L 461.01 -655.92 L 467.69 -671.5 L 467.69 -689.31" fill="none" stroke="currentColor" strokeWidth="58.4" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="917.9" strokeDashoffset="917.9" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="917.9" to="0" dur="0.286s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 269.53 -368.7 L 271.76 -368.7" fill="none" stroke="currentColor" strokeWidth="55.1" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="57.3" strokeDashoffset="57.3" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.436s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="57.3" to="0" dur="0.001s" begin="0.436s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
