import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 272 1000">
  <path d="M 58.01 -185.98 L 166.83 -324.64 L 170.15 -328.51 L 183.4 -333.48 L 186.17 -335.69 L 188.38 -355.02" fill="none" stroke="currentColor" strokeWidth="23.8" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="242.3" strokeDashoffset="242.3" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="242.3" to="0" dur="0.073s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 186.17 -335.69 L 189.48 -332.37 L 216 -252.27 L 234.23 -202 L 233.67 -193.17 L 231.46 -186.54" fill="none" stroke="currentColor" strokeWidth="30.0" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="188.4" strokeDashoffset="188.4" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.223s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="188.4" to="0" dur="0.053s" begin="0.223s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
