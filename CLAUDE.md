# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev      # Start development server with Vite
npm run build    # TypeScript compilation and production build
npm run tsc      # Run TypeScript compiler only
npm run format   # Format code with Prettier
```

## Architecture Overview

SKÅPA is a web application for generating customizable 3D printable models for IKEA SKÅDIS pegboards. The application uses a sophisticated 3D rendering pipeline and computational geometry.

### Core Technologies
- **Manifold-3d**: WebAssembly-based 3D geometry engine for generating parametric models
- **Three.js**: 3D rendering with custom outline effects
- **Twrl**: Custom JSX-like syntax for DOM manipulation (uses `jsx: "react-jsx"` with `jsxImportSource: "twrl"`)
- **Vite**: Build system and development server
- **TypeScript**: Strict typing with path aliases (`@src/*` maps to `src/*`)

### Key Architecture Components

#### 3D Model Generation (`src/model/`)
- `manifold.ts`: Core geometry generation using Manifold WebAssembly
  - `box()`: Main function that generates complete model with clips
  - `base()`: Generates hollow box structure
  - `clips()`: Generates SKÅDIS-compatible clips with optional chamfering
  - All dimensions in millimeters, clips are 12mm height (`CLIP_HEIGHT`)

#### Rendering Pipeline (`src/rendering/`)
- `renderer.ts`: Custom Three.js renderer with orthographic camera and post-processing
- `effects/outline/`: Custom outline rendering for technical drawing aesthetic
- `effects/thicken/`: Line thickening pass for better visibility
- `effects/antialiasing.ts`: FXAA antialiasing
- Uses EffectComposer for multi-pass rendering pipeline

#### Interactive Controls (`src/controls.tsx`)
- `rangeControl()`: Slider + number input combination
- `stepper()`: Plus/minus button controls for discrete values
- Uses Twrl JSX syntax for DOM generation

#### State Management (`src/main.ts`)
- Uses custom `Dyn` reactive system from twrl library
- `modelDimensions`: Core model parameters (height, width, depth, radius, wall, bottom)
- `animations`: Animated versions of dimensions for smooth transitions
- `partPositioning`: Interactive rotation state machine

### Animation System
- Custom `Animate` class for smooth parameter transitions
- Three states for part rotation: "static", "will-move", "moving"
- Camera auto-centering with overflow calculations for responsive layout
- Real-time geometry regeneration on parameter changes

### File Export
- Uses `@jscadui/3mf-export` for 3MF file generation
- Background model loading with `TMFLoader` class
- Models named as `skapa-{width}-{depth}-{height}.3mf`

### Development Notes
- Uses path aliases: `@src/*` maps to `src/*`
- Three.js coordinate system aligned with 3D printer (Z-up): `THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1)`
- Strict TypeScript with unused parameter/local checking enabled
- All geometry calculations assume millimeter units