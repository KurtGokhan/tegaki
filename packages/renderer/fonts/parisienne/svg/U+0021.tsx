import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -1875 761 2790">
  <path d="M 208.11 -270.68 L 224.67 -278.96 L 245.36 -320.35 L 762.7 -1396.42 L 775.12 -1417.12 L 841.34 -1437.81" fill="none" stroke="currentColor" strokeWidth="70.0" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="1422.3" strokeDashoffset="1422.3" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="1422.3" to="0" dur="0.451s" begin="0.000s" fill="freeze"/>
  </path>
  <circle cx="121.2" cy="-63.75" r="35.0" fill="currentColor" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.601s" fill="freeze"/>
  </circle>
</svg>);
export default SvgComponent;
