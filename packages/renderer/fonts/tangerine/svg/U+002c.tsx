import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 112 1000">
  <path d="M 4.97 81.72 L 22.75 67.75 L 35.46 55.89 L 45.2 44.03 L 53.25 31.75 L 60.02 16.08 L 62.56 6.34 L 66.37 -14.41 L 67.65 -33.04 L 71.46 -50.41" fill="none" stroke="currentColor" strokeWidth="20.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="175.6" strokeDashoffset="175.6" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="175.6" to="0" dur="0.052s" begin="0.000s" fill="freeze"/>
  </path>
  <circle cx="30.8" cy="60.55" r="6.4" fill="currentColor" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.202s" fill="freeze"/>
  </circle>
</svg>);
export default SvgComponent;
