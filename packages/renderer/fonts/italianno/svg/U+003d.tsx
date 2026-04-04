import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 344 1250">
  <path d="M 86.56 -248.18 L 104.32 -257.05 L 127.4 -265.04 L 338.68 -263.27 L 368.86 -273.92 L 379.52 -280.13" fill="none" stroke="currentColor" strokeWidth="18.0" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="317.9" strokeDashoffset="317.9" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="317.9" to="0" dur="0.100s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 62.6 -128.33 L 102.54 -144.31 L 311.16 -142.54 L 353.77 -157.63" fill="none" stroke="currentColor" strokeWidth="19.6" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="316.5" strokeDashoffset="316.5" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.250s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="316.5" to="0" dur="0.099s" begin="0.250s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
