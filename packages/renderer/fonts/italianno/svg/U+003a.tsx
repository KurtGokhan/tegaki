import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 154 1250">
  <path d="M 79.36 -17.88 L 94.16 -17.88 L 129.52 -27.74" fill="none" stroke="currentColor" strokeWidth="28.2" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="79.7" strokeDashoffset="79.7" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="79.7" to="0" dur="0.017s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 144.32 -267.87 L 164.88 -267.87 L 168.99 -270.33 L 179.68 -271.16 L 201.07 -276.91" fill="none" stroke="currentColor" strokeWidth="30.5" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="88.7" strokeDashoffset="88.7" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.167s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="88.7" to="0" dur="0.019s" begin="0.167s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
