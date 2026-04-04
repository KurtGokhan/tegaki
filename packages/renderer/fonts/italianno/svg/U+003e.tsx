import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 293 1250">
  <path d="M 132.18 -364.8 L 135.66 -349.98 L 148.74 -333.42 L 208.02 -274.14 L 252.48 -234.91 L 262.07 -212.24 L 253.35 -201.78 L 180.12 -159.94 L 156.58 -144.25 L 93.82 -96.3 L 84.23 -86.71 L 82.49 -56.2" fill="none" stroke="currentColor" strokeWidth="30.8" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="484.2" strokeDashoffset="484.2" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="484.2" to="0" dur="0.151s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 262.07 -212.24 L 283.86 -210.5" fill="none" stroke="currentColor" strokeWidth="38.5" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="60.3" strokeDashoffset="60.3" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.301s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="60.3" to="0" dur="0.007s" begin="0.301s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
