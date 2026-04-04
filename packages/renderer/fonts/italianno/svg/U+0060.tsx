import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 223 1250">
  <path d="M 55.27 -434.17 L 61.97 -423.37 L 73.9 -413.31 L 124.58 -376.04 L 163.7 -349.59 L 177.86 -341.39 L 182.33 -337.29" fill="none" stroke="currentColor" strokeWidth="15.1" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="176.0" strokeDashoffset="176.0" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="176.0" to="0" dur="0.054s" begin="0.000s" fill="freeze"/>
  </path>
  <circle cx="63.09" cy="-422.25" r="13.0" fill="currentColor" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.204s" fill="freeze"/>
  </circle>
</svg>);
export default SvgComponent;
