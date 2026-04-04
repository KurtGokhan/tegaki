import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 353 1260">
  <path d="M 295.83 -556.82 L 322.96 -510 L 339.15 -477.18 L 340.9 -470.62 L 339.15 -458.8 L 336.96 -452.24" fill="none" stroke="currentColor" strokeWidth="49.4" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="165.7" strokeDashoffset="165.7" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="165.7" to="0" dur="0.039s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
