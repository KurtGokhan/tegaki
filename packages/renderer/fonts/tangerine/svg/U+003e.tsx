import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 301 1000">
  <path d="M 32.32 -70.58 L 45.07 -79.3 L 53.8 -82.66 L 230.94 -139.02 L 237.65 -149.09 L 261.14 -150.43" fill="none" stroke="currentColor" strokeWidth="18.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="265.2" strokeDashoffset="265.2" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="265.2" to="0" dur="0.082s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 90.7 -218.2 L 98.08 -218.87 L 230.27 -159.15 L 232.95 -157.81 L 238.32 -149.09" fill="none" stroke="currentColor" strokeWidth="24.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="190.6" strokeDashoffset="190.6" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.232s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="190.6" to="0" dur="0.055s" begin="0.232s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
