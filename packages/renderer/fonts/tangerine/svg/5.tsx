import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 250 1000">
  <path d="M -62.93 97.82 L -54.87 113.94 L -42.78 127.38 L -32.03 134.09 L -7.85 139.47 L 39.17 136.78 L 63.35 132.75 L 102.31 116.63 L 133.21 93.79 L 153.36 73.64 L 169.48 48.12 L 177.54 27.97 L 185.6 -12.33 L 185.6 -47.26 L 169.48 -88.91 L 126.49 -131.89 L 102.31 -143.98 L 92.91 -154.73 L 92.91 -182.94 L 99.62 -213.84 L 121.12 -267.58 L 141.27 -286.38 L 160.07 -291.76 L 215.15 -293.1 L 259.48 -298.47 L 272.92 -303.85 L 293.07 -328.03" fill="none" stroke="currentColor" strokeWidth="29.0" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="868.4" strokeDashoffset="868.4" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="868.4" to="0" dur="0.280s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
