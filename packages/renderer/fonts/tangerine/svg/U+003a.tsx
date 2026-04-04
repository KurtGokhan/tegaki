import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 156 1000">
  <path d="M 35.17 -18.88 L 54.18 -40" fill="none" stroke="currentColor" strokeWidth="34.8" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="63.2" strokeDashoffset="63.2" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="63.2" to="0" dur="0.009s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 97.12 -210.37 L 124.58 -241.34" fill="none" stroke="currentColor" strokeWidth="30.6" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="72.0" strokeDashoffset="72.0" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.159s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="72.0" to="0" dur="0.014s" begin="0.159s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
