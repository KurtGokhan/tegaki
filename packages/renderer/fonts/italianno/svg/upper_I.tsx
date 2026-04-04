import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 365 1250">
  <path d="M 14.91 -126.43 L 14.91 -96.83 L 21.87 -70.72 L 42.76 -39.39 L 70.61 -18.5 L 105.42 -11.54 L 129.8 -11.54 L 154.17 -16.76 L 206.39 -44.61 L 258.61 -95.09 L 316.06 -176.91 L 375.24 -290.06 L 430.95 -418.87 L 462.28 -467.61 L 509.28 -512.87 L 517.98 -528.54 L 625.91 -537.24 L 636.35 -542.47" fill="none" stroke="currentColor" strokeWidth="27.7" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="1002.5" strokeDashoffset="1002.5" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="1002.5" to="0" dur="0.325s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 316.06 -408.43 L 302.13 -446.73 L 296.91 -485.02 L 321.28 -512.87 L 354.35 -526.8 L 387.43 -532.02 L 511.02 -532.02 L 516.24 -526.8" fill="none" stroke="currentColor" strokeWidth="32.8" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="349.6" strokeDashoffset="349.6" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.475s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="349.6" to="0" dur="0.106s" begin="0.475s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
