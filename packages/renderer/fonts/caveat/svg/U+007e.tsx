import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 446 1260">
  <path d="M 127.74 -238.47 L 131.9 -245.74 L 176.57 -277.94 L 185.92 -283.14 L 212.93 -288.33 L 238.9 -284.18 L 314.73 -233.27 L 345.89 -227.04 L 374.98 -229.12 L 443.54 -254.05 L 453.93 -261.32 L 465.36 -273.79" fill="none" stroke="currentColor" strokeWidth="44.2" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="427.0" strokeDashoffset="427.0" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="427.0" to="0" dur="0.128s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
