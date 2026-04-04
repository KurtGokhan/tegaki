import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 450 1260">
  <path d="M 246.49 -457.27 L 294.95 -483.58 L 317.11 -490.5 L 343.42 -494.66 L 386.34 -490.5 L 409.88 -480.81 L 436.19 -461.42 L 444.49 -414.35 L 427.88 -381.12 L 384.95 -322.96 L 200.8 -127.73 L 193.88 -113.88 L 184.18 -72.34 L 177.26 -66.81 L 157.88 -66.81 L 184.18 -69.58 L 195.26 -66.81 L 247.88 -73.73 L 297.72 -88.96 L 358.65 -95.88 L 434.8 -97.27 L 456.95 -94.5 L 472.19 -91.73 L 483.26 -83.42 L 498.49 -77.88" fill="none" stroke="currentColor" strokeWidth="58.6" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="1125.2" strokeDashoffset="1125.2" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="1125.2" to="0" dur="0.356s" begin="0.000s" fill="freeze"/>
  </path>
  <circle cx="299.11" cy="-231.58" r="27.4" fill="currentColor" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.506s" fill="freeze"/>
  </circle>
</svg>);
export default SvgComponent;
