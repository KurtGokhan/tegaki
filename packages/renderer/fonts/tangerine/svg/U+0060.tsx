import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 155 1000">
  <path d="M 23.42 -366.36 L 28.16 -367.31 L 41.74 -367.62 L 53.74 -366.99 L 67.64 -356.88 L 104.29 -334.45 L 123.88 -323.71 L 126.09 -322.77 L 128.93 -322.77" fill="none" stroke="currentColor" strokeWidth="19.6" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="137.8" strokeDashoffset="137.8" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="137.8" to="0" dur="0.039s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
