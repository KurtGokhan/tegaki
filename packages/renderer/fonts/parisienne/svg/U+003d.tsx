import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -1875 800 2790">
  <path d="M 104.55 -527.07 L 155.56 -551.63 L 665.65 -551.63 L 682.66 -559.19" fill="none" stroke="currentColor" strokeWidth="39.7" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="625.0" strokeDashoffset="625.0" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="625.0" to="0" dur="0.195s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 206.57 -806.68 L 219.79 -814.24 L 731.78 -814.24 L 784.68 -838.8" fill="none" stroke="currentColor" strokeWidth="40.6" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="626.2" strokeDashoffset="626.2" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.345s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="626.2" to="0" dur="0.195s" begin="0.345s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
