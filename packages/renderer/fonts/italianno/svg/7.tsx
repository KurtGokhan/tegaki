import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -800 310 1250">
  <path d="M 131.81 -331.4 L 140.25 -337.43 L 170.4 -394.1 L 194.52 -414.6 L 208.99 -418.22 L 338.02 -417.01 L 369.37 -414.6 L 376.6 -410.98 L 412.78 -424.25 L 435.69 -437.51" fill="none" stroke="currentColor" strokeWidth="25.6" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="380.3" strokeDashoffset="380.3" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="380.3" to="0" dur="0.118s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 55.84 -4.6 L 90.81 -20.28 L 110.11 -51.63 L 154.72 -110.72 L 357.31 -360.34 L 365.75 -372.4 L 376.6 -410.98" fill="none" stroke="currentColor" strokeWidth="31.0" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="556.4" strokeDashoffset="556.4" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.268s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="556.4" to="0" dur="0.175s" begin="0.268s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
