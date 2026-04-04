import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 198 1260">
  <path d="M 123.37 -85.06 L 127.76 -85.69 L 144.37 -97.6 L 150.33 -97.6" fill="none" stroke="currentColor" strokeWidth="82.2" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="113.0" strokeDashoffset="113.0" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="113.0" to="0" dur="0.010s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
