import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 330 1260">
  <path d="M 405.01 -722.13 L 407.5 -712.17 L 395.05 -674.82 L 255.62 -341.19 L 203.34 -186.82 L 133.62 54.69 L 138.6 111.95" fill="none" stroke="currentColor" strokeWidth="59.6" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="942.7" strokeDashoffset="942.7" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="942.7" to="0" dur="0.294s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
