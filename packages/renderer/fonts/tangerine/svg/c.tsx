import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 -750 203 1000">
  <path d="M 176.68 -180.5 L 181.61 -187.54 L 189.36 -218.52 L 187.24 -226.97 L 176.68 -237.53 L 165.42 -241.75 L 140.78 -239.64 L 126 -236.12 L 108.4 -224.15 L 95.02 -211.48 L 87.98 -202.33 L 74.6 -179.8 L 66.86 -162.2 L 54.89 -120.66 L 48.56 -68.57 L 49.96 -50.26 L 55.6 -35.48 L 66.86 -22.1 L 79.53 -16.47 L 89.39 -16.47 L 109.8 -19.99 L 130.92 -27.74 L 152.04 -42.52 L 181.61 -72.09 L 170.35 -59.42" fill="none" stroke="currentColor" strokeWidth="24.8" strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="536.5" strokeDashoffset="536.5" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="0.000s" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="536.5" to="0" dur="0.171s" begin="0.000s" fill="freeze"/>
  </path>
</svg>);
export default SvgComponent;
