import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 330 1260">
  <path d="M 303.2 -701.76 L 319.53 -690.1 L 335.86 -650.44 L 342.86 -615.45 L 342.86 -568.79 L 333.53 -426.49 L 303.2 -270.18 L 261.21 -153.54 L 205.22 -36.9 L 144.57 47.09 L 111.91 77.41 L 81.58 89.08 L 58.25 82.08" fill="none" stroke="currentColor" strokeWidth="53.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="959.4" strokeDashoffset="959.4" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="959.4" to="0" dur="0.302s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
