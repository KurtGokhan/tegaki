const bundles = import.meta.glob('../../output/*/bundle.ts', { eager: true });
const bundlePath = Object.keys(bundles)[0];
if (!bundlePath) throw new Error('No font bundle found in output/. Run the generator first.');
const font = (bundles[bundlePath] as { default: import('tegaki').TegakiBundle }).default;

await font.registerFontFace();

export default font;
