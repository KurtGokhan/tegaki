import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 120 1000">
  <path d="M 56.97 -276.16 L 136.94 -385.26 L 145.16 -392.36 L 154.5 -396.85 L 160.85 -398.34" fill="none" stroke="currentColor" strokeWidth="20.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="183.9" strokeDashoffset="183.9" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="183.9" to="0" dur="0.054s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
