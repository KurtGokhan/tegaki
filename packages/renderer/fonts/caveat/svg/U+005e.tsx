import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 446 1260">
  <path d="M 146.49 -322.34 L 155.13 -338.76 L 164.64 -364.69 L 191.43 -418.27 L 227.72 -468.39 L 248.46 -490.86 L 270.07 -508.14 L 283.9 -514.19 L 311.55 -519.38 L 320.19 -515.92 L 328.83 -509.01 L 365.99 -439.87 L 416.12 -327.53 L 418.71 -317.16 L 416.98 -311.97" fill="none" stroke="currentColor" strokeWidth="49.8" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="557.3" strokeDashoffset="557.3" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="557.3" to="0" dur="0.169s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
