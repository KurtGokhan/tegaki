import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -1875 800 2790">
  <path d="M 101.21 -388.16 L 175.33 -423.73 L 568.12 -423.73 L 596.28 -438.55" fill="none" stroke="currentColor" strokeWidth="48.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="555.7" strokeDashoffset="555.7" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="555.7" to="0" dur="0.169s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
