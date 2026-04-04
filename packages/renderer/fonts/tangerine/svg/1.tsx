import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 189 1000">
  <path d="M 75.49 -251.7 L 118.79 -260.92 L 151.96 -271.05 L 163.93 -272.89 L 168.54 -268.29 L 173.14 -269.21 L 201.7 -297.77" fill="none" stroke="currentColor" strokeWidth="25.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="168.6" strokeDashoffset="168.6" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="168.6" to="0" dur="0.048s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 172.22 -269.21 L 169.46 -265.52 L 166.7 -249.86 L 132.61 -180.77 L 102.21 -109.83 L 73.65 -28.76 L 54.3 -4.81" fill="none" stroke="currentColor" strokeWidth="36.1" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="327.6" strokeDashoffset="327.6" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.198s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="327.6" to="0" dur="0.097s" begin="0.198s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
