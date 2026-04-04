import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 331 1260">
  <path d="M 138.53 -317.95 L 150.11 -281.56 L 166.65 -194.7 L 182.37 -131 L 191.47 -112.8 L 195.6 -107.84 L 203.88 -103.7 L 204.7 -97.08 L 203.05 -92.95 L 207.19 -103.7 L 238.62 -114.45 L 273.36 -147.54 L 309.76 -194.7 L 339.54 -236.89 L 363.53 -274.94 L 390 -310.51" fill="none" stroke="currentColor" strokeWidth="59.6" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="592.2" strokeDashoffset="592.2" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="592.2" to="0" dur="0.178s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
