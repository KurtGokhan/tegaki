import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -960 482 1260">
  <path d="M 316.7 -632.27 L 324.75 -638.31 L 304.61 -614.15 L 262.33 -535.62 L 218.03 -422.86 L 179.77 -291.97 L 153.59 -155.05 L 151.58 -84.57 L 159.64 -32.22 L 191.85 6.04 L 240.18 18.12 L 294.55 0 L 334.82 -30.21 L 417.38 -128.87 L 485.84 -235.59 L 540.21 -350.37 L 562.36 -408.76 L 620.75 -618.18" fill="none" stroke="currentColor" strokeWidth="62.5" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="1583.4" strokeDashoffset="1583.4" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="1583.4" to="0" dur="0.507s" begin="0.000s" fill="freeze"/>
  </path>
  <path d="M 425.43 -146.99 L 427.44 -146.99" fill="none" stroke="currentColor" strokeWidth="57.3" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="59.3" strokeDashoffset="59.3" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.657s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="59.3" to="0" dur="0.001s" begin="0.657s" fill="freeze"/>
  </path>
  <circle cx="356.97" cy="-54.37" r="30.5" fill="currentColor" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.808s" fill="freeze"/>
  </circle>
</svg>);
export default SvgComponent;
