# tegaki

## 0.5.0

### Minor Changes

- [`dc581bf`](https://github.com/KurtGokhan/tegaki/commit/dc581bf2e68324ba810c01aea3b7d5c646462a42) Thanks [@KurtGokhan](https://github.com/KurtGokhan)! - Fix font bundle types and make sure they are assignable to the expected type.

## 0.4.0

### Minor Changes

- [`2236325`](https://github.com/KurtGokhan/tegaki/commit/2236325c7119b6de47be3f479b3e01b2cae4b907) Thanks [@KurtGokhan](https://github.com/KurtGokhan)! - Rework font loading and improve defaults

  - **Breaking**: Remove `registerFontFace()` from `TegakiBundle`. Font registration is now handled internally by `TegakiRenderer` via the FontFace API.
  - Add `fontFaceCSS` property to `TegakiBundle` for SSR/stylesheet-based font loading.
  - Export `ensureFontFace()` utility for manually preloading a bundle's font.
  - Fix font layout being calculated with wrong font metrics when switching fonts or when the font isn't loaded yet.
  - Enable `pressureWidth` effect by default.
  - Handle non-JS environments (SSR) more gracefully.

## 0.3.1

### Patch Changes

- [`706375b`](https://github.com/KurtGokhan/tegaki/commit/706375bf056caefb8fd4c4279da9e0124535b706) Thanks [@KurtGokhan](https://github.com/KurtGokhan)! - Accessibility, SSR and RSC fixes

## 0.3.0

### Minor Changes

- [`2295113`](https://github.com/KurtGokhan/tegaki/commit/2295113f02a0d67c398258846ba5576a5c162d96) Thanks [@KurtGokhan](https://github.com/KurtGokhan)! - - Reduced font bundle data size
  - Fix rerendering when color changes
  - Fix padding and border issue in renderer

## 0.2.3

### Patch Changes

- [`d171776`](https://github.com/KurtGokhan/tegaki/commit/d171776e48eae2063246209e8b56bf9e9185f4c7) Thanks [@KurtGokhan](https://github.com/KurtGokhan)! - Fix layout issues when font is being loaded. Fix layout being calculated with ligatures.

## 0.2.2

### Patch Changes

- [`4f5c639`](https://github.com/KurtGokhan/tegaki/commit/4f5c639799056093a8797dbb6a84cd6989500811) Thanks [@KurtGokhan](https://github.com/KurtGokhan)! - changeset fix

## 0.2.1

### Patch Changes

- [`1b079f5`](https://github.com/KurtGokhan/tegaki/commit/1b079f5dd6cb174b9b272c5e217dd1df1e5c0b12) Thanks [@KurtGokhan](https://github.com/KurtGokhan)! - initial release

## 0.2.0

### Minor Changes

- [`273bd36`](https://github.com/KurtGokhan/tegaki/commit/273bd36ece40ad3629aad2f62d3bcf3849a59cf0) Thanks [@KurtGokhan](https://github.com/KurtGokhan)! - Beta release of Tegaki, a handwriting animation library for JavaScript and React. This release includes basic support for rendering handwriting animations, as well as a browser based animation generator. Future updates will focus on improving stroke orders for better natural handwriting estimation. We welcome feedback and contributions from the community to help make Tegaki even better!
