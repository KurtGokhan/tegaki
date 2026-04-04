import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 129 1250">
  <path d="M 55.71 -27.67 L 64.26 -31.74 L 67.92 -32.14 L 81.76 -30.92 L 96.41 -26.44 L 101.7 -33.77 L 103.33 -39.87" fill="none" stroke="currentColor" strokeWidth="27.8" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="85.5" strokeDashoffset="85.5" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="85.5" to="0" dur="0.019s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 43.1 76.93 L 53.68 68.39 L 67.92 53.74 L 77.28 41.93 L 85.42 29.72 L 91.12 16.29 L 95.19 -3.65 L 96.82 -19.12 L 96.41 -26.44" fill="none" stroke="currentColor" strokeWidth="26.7" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="148.3" strokeDashoffset="148.3" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.169s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="148.3" to="0" dur="0.041s" begin="0.169s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
