import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 295 1250">
  <path d="M 171.46 -129.29 L 182.63 -140.45 L 193.79 -162.78 L 346.91 -515.27 L 404.33 -563.12" fill="none" stroke="currentColor" strokeWidth="26.9" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="526.7" strokeDashoffset="526.7" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="526.7" to="0" dur="0.167s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 117.23 -17.64 L 149.13 -19.23 L 171.46 -27.21" fill="none" stroke="currentColor" strokeWidth="23.4" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="79.0" strokeDashoffset="79.0" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.317s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="79.0" to="0" dur="0.019s" begin="0.317s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
