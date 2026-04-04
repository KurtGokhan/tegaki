import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 330 1260">
  <path d="M 497.18 -731.47 L 450.47 -701.97 L 396.39 -650.34 L 332.47 -552 L 273.47 -446.29 L 197.25 -254.53 L 172.67 -121.78 L 172.67 -62.78 L 184.96 3.6 L 214.46 55.23 L 246.42 84.73 L 293.13 104.39" fill="none" stroke="currentColor" strokeWidth="56.6" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="1046.4" strokeDashoffset="1046.4" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="1046.4" to="0" dur="0.330s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
