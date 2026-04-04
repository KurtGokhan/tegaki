import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 315 1260">
  <path d="M 121.3 -332.05 L 154.91 -333.1 L 179.06 -328.9 L 252.58 -327.85 L 304.04 -323.65 L 322.95 -317.35 L 331.35 -298.44 L 331.35 -293.19 L 326.1 -277.44 L 193.77 -187.12 L 130.75 -133.55 L 99.24 -101 L 87.69 -63.19 L 82.44 -57.94 L 79.29 -57.94 L 86.64 -60.04 L 95.04 -52.68 L 144.4 -55.84 L 218.97 -65.29 L 355.5 -72.64 L 390.16 -66.34" fill="none" stroke="currentColor" strokeWidth="54.5" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="954.0" strokeDashoffset="954.0" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="954.0" to="0" dur="0.300s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
