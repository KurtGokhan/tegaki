import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 214 1000">
  <path d="M 56.02 -275.5 L 135.33 -383.6 L 145.9 -392.99 L 158.82 -398.28" fill="none" stroke="currentColor" strokeWidth="21.6" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="183.8" strokeDashoffset="183.8" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="183.8" to="0" dur="0.054s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 150.01 -275.5 L 229.32 -384.18 L 241.07 -393.58 L 252.82 -398.28" fill="none" stroke="currentColor" strokeWidth="21.2" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="183.5" strokeDashoffset="183.5" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.204s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="183.5" to="0" dur="0.054s" begin="0.204s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
