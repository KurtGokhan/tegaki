import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 210 1260">
  <path d="M 359.56 -696.56 L 361.55 -676.69 L 347.64 -638.94 L 270.16 -479.99 L 210.55 -334.95 L 182.73 -235.6 L 186.71 -199.84" fill="none" stroke="currentColor" strokeWidth="58.3" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="591.3" strokeDashoffset="591.3" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="591.3" to="0" dur="0.178s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 119.15 -46.85 L 133.06 -56.78" fill="none" stroke="currentColor" strokeWidth="87.5" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="104.6" strokeDashoffset="104.6" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.328s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="104.6" to="0" dur="0.006s" begin="0.328s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
