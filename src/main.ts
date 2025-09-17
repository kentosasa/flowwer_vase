import "./style.css";

import * as THREE from "three";
import { Renderer } from "./rendering/renderer";

import { hollowCylinder } from "./model/manifold";
import { mesh2geometry } from "./model/export";
import { TMFLoader } from "./model/load";
import { Animate, immediate } from "./animate";

import { Dyn } from "twrl";

import { rangeControl, checkbox } from "./controls";

/// CONSTANTS

// Align axes with 3D printer
THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);


// constants for cylinder dimensions

const START_HEIGHT = 50;
const MIN_HEIGHT = 10;
const MAX_HEIGHT = 200;

const START_OUTER_RADIUS = 25;
const MIN_OUTER_RADIUS = 5;
const MAX_OUTER_RADIUS = 100;

const START_WALL_THICKNESS = 3;
const MIN_WALL_THICKNESS = 1;
const MAX_WALL_THICKNESS = 20;

const START_CLOSED_BOTTOM = true;

/// STATE

// Dimensions of the cylinder model.
// These are the dimensions of the 3MF file, as well as
// the _target_ dimensions for the animations, though may
// be (ephemerally) different from the animation values.

const modelDimensions = {
  height: new Dyn(START_HEIGHT),
  outerRadius: new Dyn(START_OUTER_RADIUS),
  wallThickness: new Dyn(START_WALL_THICKNESS),
  closedBottom: new Dyn(START_CLOSED_BOTTOM),
};



// Current state of part positioning
type PartPositionStatic = Extract<PartPosition, { tag: "static" }>;
type PartPosition =
  | {
      tag: "static";
      position: -1 | 0 | 1;
    } /* no current mouse interaction. -1 and +1 are different as they represent different ways of showing the back of the part (CW or CCW) */
  | {
      tag: "will-move";
      startRot: number;
      startPos: [number, number];
      clock: THREE.Clock;
      lastStatic: Extract<PartPosition, { tag: "static" }>;
    } /* mouse was down but hasn't moved yet */
  | {
      tag: "moving";
      startRot: number;
      startPos: [number, number];
      lastStatic: Extract<PartPosition, { tag: "static" }>;
      clock: THREE.Clock;
      x: number;
    } /* mouse is moving */;
const partPositioning = new Dyn<PartPosition>({ tag: "static", position: 0 });

/// MODEL

const tmfLoader = new TMFLoader();

// Reloads the model seen on page
async function reloadModel(
  height: number,
  outerRadius: number,
  wallThickness: number,
  closedBottom: boolean,
) {
  const model = await hollowCylinder(height, outerRadius, wallThickness, closedBottom);
  const geometry = mesh2geometry(model);
  geometry.computeVertexNormals(); // Make sure the geometry has normals
  mesh.geometry = geometry;
  mesh.clear(); // Remove all children
}

// when target dimensions are changed, update the model to download
Dyn.sequence([
  modelDimensions.height,
  modelDimensions.outerRadius,
  modelDimensions.wallThickness,
  modelDimensions.closedBottom,
] as const).addListener(([h, r, w, closed]) => {
  const bottomType = closed ? "closed" : "open";
  const filename = `cylinder-${(r * 2).toFixed(0)}x${h.toFixed(0)}-wall${w.toFixed(0)}-${bottomType}.3mf`;
  tmfLoader.load(hollowCylinder(h, r, w, closed), filename);
});

/// RENDER

// Set to 'true' whenever the camera needs to be centered again
let centerCameraNeeded = true;

// The mesh, updated in place when the geometry needs to change
const mesh: THREE.Mesh = new THREE.Mesh(
  new THREE.CylinderGeometry(
    modelDimensions.outerRadius.latest,
    modelDimensions.outerRadius.latest,
    modelDimensions.height.latest,
    32,
  ),
  new THREE.Material(),
);

// Center the camera around the mesh
async function centerCamera() {
  // Create a "world" matrix which only includes the part rotation (we don't use the actual
  // world matrix to avoid rotation animation messing with the centering)
  const mat = new THREE.Matrix4();
  mat.makeRotationAxis(new THREE.Vector3(0, 0, 1), MESH_ROTATION_DELTA);
  renderer.centerCameraAround(mesh, mat);
}

const MESH_ROTATION_DELTA = 0.1;
mesh.rotation.z = MESH_ROTATION_DELTA;

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = new Renderer(canvas, mesh);

let reloadModelNeeded = true;

// The animated rotation, between -1 and 1
const rotation = new Animate(0);

/* Bound the number betweek lo & hi (modulo) */
const bound = (v: number, [lo, hi]: [number, number]): number =>
  ((v - lo) % (hi - lo)) + lo;

partPositioning.addListener((val) => {
  if (val.tag === "static") {
    rotation.startAnimationTo(val.position);
  } else if (val.tag === "moving") {
    /* the delta of width (between -1 and 1, so 2) per delta of (horizontal, CSS) pixel */
    const dwdx = 2 / renderer.canvasWidth;
    const v = (val.x - val.startPos[0]) * dwdx - val.startRot;
    rotation.startAnimationTo(bound(v, [-1, 1]), immediate);
  } else {
    val.tag satisfies "will-move";
    /* not movement yet, so not need to move */
  }
});

/// ANIMATIONS

// The animated dimensions (booleans don't need animation)
const animations = {
  height: new Animate(START_HEIGHT),
  outerRadius: new Animate(START_OUTER_RADIUS),
  wallThickness: new Animate(START_WALL_THICKNESS),
};

// Only animate numeric dimensions
(["height", "outerRadius", "wallThickness"] as const).forEach((dim) =>
  modelDimensions[dim].addListener((val) => {
    animations[dim].startAnimationTo(val);
  }),
);

/// DOM

// Download button
const link = document.querySelector("a")!;

const controls = document.querySelector(".controls") as HTMLDivElement;

const heightControl = rangeControl("height", {
  name: "Height",
  min: String(MIN_HEIGHT),
  max: String(MAX_HEIGHT),
  sliderMin: String(MIN_HEIGHT),
  sliderMax: String(MAX_HEIGHT),
});
controls.append(heightControl.wrapper);

const outerRadiusControl = rangeControl("outerRadius", {
  name: "Outer Radius",
  min: String(MIN_OUTER_RADIUS),
  max: String(MAX_OUTER_RADIUS),
  sliderMin: String(MIN_OUTER_RADIUS),
  sliderMax: String(MAX_OUTER_RADIUS),
});
controls.append(outerRadiusControl.wrapper);

const wallThicknessControl = rangeControl("wallThickness", {
  name: "Wall Thickness",
  min: String(MIN_WALL_THICKNESS),
  max: String(MAX_WALL_THICKNESS),
  sliderMin: String(MIN_WALL_THICKNESS),
  sliderMax: String(MAX_WALL_THICKNESS),
});
controls.append(wallThicknessControl.wrapper);

const closedBottomControl = checkbox("closedBottom", {
  label: "Closed Bottom",
  checked: START_CLOSED_BOTTOM,
});
controls.append(closedBottomControl);

// The dimension inputs
const inputs = {
  height: heightControl.input,
  heightRange: heightControl.range,
  outerRadius: outerRadiusControl.input,
  outerRadiusRange: outerRadiusControl.range,
  wallThickness: wallThicknessControl.input,
  wallThicknessRange: wallThicknessControl.range,
  closedBottom: document.querySelector("#closedBottom")! as HTMLInputElement,
} as const;

// Add change events to all dimension inputs

// height
(
  [
    [inputs.height, "change"],
    [inputs.heightRange, "input"],
  ] as const
).forEach(([input, evnt]) => {
  modelDimensions.height.addListener((height) => {
    input.value = `${height}`;
  });
  input.addEventListener(evnt, () => {
    const value = parseInt(input.value);
    if (!Number.isNaN(value))
      modelDimensions.height.send(Math.max(MIN_HEIGHT, Math.min(value, MAX_HEIGHT)));
  });
});

// outer radius
(
  [
    [inputs.outerRadius, "change"],
    [inputs.outerRadiusRange, "input"],
  ] as const
).forEach(([input, evnt]) => {
  modelDimensions.outerRadius.addListener((radius) => {
    input.value = `${radius}`;
  });
  input.addEventListener(evnt, () => {
    const value = parseInt(input.value);
    if (!Number.isNaN(value))
      modelDimensions.outerRadius.send(Math.max(MIN_OUTER_RADIUS, Math.min(value, MAX_OUTER_RADIUS)));
  });
});

// wall thickness
(
  [
    [inputs.wallThickness, "change"],
    [inputs.wallThicknessRange, "input"],
  ] as const
).forEach(([input, evnt]) => {
  modelDimensions.wallThickness.addListener((thickness) => {
    input.value = `${thickness}`;
  });
  input.addEventListener(evnt, () => {
    const value = parseInt(input.value);
    if (!Number.isNaN(value))
      modelDimensions.wallThickness.send(Math.max(MIN_WALL_THICKNESS, Math.min(value, MAX_WALL_THICKNESS)));
  });
});

// closed bottom
inputs.closedBottom.addEventListener("change", () => {
  modelDimensions.closedBottom.send(inputs.closedBottom.checked);
});

// Add select-all on input click for number inputs
(["height", "outerRadius", "wallThickness"] as const).forEach((dim) => {
  const input = inputs[dim];
  input.addEventListener("focus", () => {
    input.select();
  });
});

/* Extract X & Y from event (offsetX/Y) */
const eventCoords = (e: MouseEvent | TouchEvent): [number, number] => {
  // Simple case of a mouse event
  if (e instanceof MouseEvent) {
    return [e.offsetX, e.offsetY];
  }

  // Now, try to extract values similar to offsetXY from a TouchEvent, if possible
  const target = e.target;
  if (!target) {
    console.warn("Event doesn't have target", e);
    return [0, 0];
  }

  if (!(target instanceof HTMLElement)) {
    console.warn("Event target is not an element", e);
    return [0, 0];
  }

  const rect = target.getBoundingClientRect();
  const x = e.targetTouches[0].clientX - rect.x;
  const y = e.targetTouches[0].clientY - rect.y;
  return [x, y];
};

/* Get ready on first touchdown */

const readyMouseTarget = canvas;
const readyMouseEvents = ["mousedown", "touchstart"] as const;
const readyMouse = (e: MouseEvent | TouchEvent) => {
  renderer.render();

  const [x, y] = eventCoords(e);
  const [r, g, b, a] = renderer.getCanvasPixelColor([x, y]);

  // The outline rendering renders transparent pixels outside of the part
  // So if it's transparent, assume the user didn't want to touch/rotate the part
  if (r === 0 && g === 0 && b === 0 && a === 0) {
    return;
  }

  e.preventDefault(); // Prevent from scrolling the page while moving the part
  partPositioning.update((val) => {
    if (val.tag === "will-move" || val.tag === "moving") {
      return val;
    } else {
      const clock = new THREE.Clock();
      clock.start();
      return {
        tag: "will-move",
        startRot: rotation.current,
        startPos: [x, y],
        clock,
        lastStatic: val,
      };
    }
  });

  trackMouseEvents.forEach((evt) =>
    trackMouseTarget.addEventListener(evt, trackMouse, { passive: false }),
  );
  forgetMouseEvents.forEach((evt) =>
    forgetMouseTarget.addEventListener(evt, forgetMouse),
  );
};

readyMouseEvents.forEach((evt) =>
  readyMouseTarget.addEventListener(evt, readyMouse),
);

/* Start tracking mouse mouvement across the window */
const trackMouseTarget = window;
const trackMouseEvents = ["mousemove", "touchmove"] as const;
const trackMouse = (e: MouseEvent | TouchEvent) => {
  const [x] = eventCoords(e);

  partPositioning.update((val) => {
    if (val.tag === "will-move" || val.tag === "moving") {
      return {
        tag: "moving",
        x,

        startPos: val.startPos,
        startRot: val.startRot,
        lastStatic: val.lastStatic,
        clock: val.clock,
      };
    }

    // This is technically not possible, unless the browser sends events
    // in incorrect order
    val.tag satisfies "static";
    return val;
  });
};

const forgetMouseTarget = window;
const forgetMouseEvents = ["mouseup", "touchend"] as const;
const forgetMouse = () => {
  trackMouseEvents.forEach((evt) =>
    trackMouseTarget.removeEventListener(evt, trackMouse),
  );
  forgetMouseEvents.forEach((evt) =>
    forgetMouseTarget.removeEventListener(evt, forgetMouse),
  );

  /* toggle static positioning between front & back */
  const toggle = (p: PartPositionStatic): PartPositionStatic =>
    ({
      [-1]: { tag: "static", position: 0 } as const,
      [0]: { tag: "static", position: 1 } as const,
      [1]: { tag: "static", position: 0 } as const,
    })[p.position];

  partPositioning.update((was) => {
    if (was.tag === "will-move") {
      // Mouse was down but didn't move, assume toggle
      return toggle(was.lastStatic);
    } else if (was.tag === "static") {
      // Mouse was down and up, i.e. "clicked", toggle
      return toggle(was);
    } else {
      // Mouse has moved
      was.tag satisfies "moving";

      // If the move was too short, assume toggle (jerk)
      const elapsed = was.clock.getElapsedTime();
      const delta = Math.abs(was.x - was.startPos[0]);
      if (elapsed < 0.3 && delta < 15) {
        return toggle(was.lastStatic);
      }

      // Snap part to one of the static positions
      const rounded = Math.round(bound(rotation.current, [-1, 1]));
      if (rounded <= -1) {
        return { tag: "static", position: -1 };
      } else if (1 <= rounded) {
        return { tag: "static", position: 1 };
      } else {
        return { tag: "static", position: 0 };
      }
    }
  });
};

/// LOOP

// Set to current frame's timestamp when a model starts loading, and set
// to undefined when the model has finished loading
let modelLoadStarted: undefined | DOMHighResTimeStamp;

function loop(nowMillis: DOMHighResTimeStamp) {
  requestAnimationFrame(loop);

  // Reload 3mf if necessary
  const newTmf = tmfLoader.take();
  if (newTmf !== undefined) {
    // Update the download link
    link.href = URL.createObjectURL(newTmf.blob);
    link.download = newTmf.filename;
  }

  // Handle rotation animation
  const rotationUpdated = rotation.update();
  if (rotationUpdated) {
    mesh.rotation.z = rotation.current * Math.PI + MESH_ROTATION_DELTA;
  }

  // Handle dimensions animation (only for numeric dimensions)
  const dimensionsUpdated = (["height", "outerRadius", "wallThickness"] as const).reduce(
    (acc, dim) => animations[dim].update() || acc,
    false,
  );

  if (dimensionsUpdated) {
    reloadModelNeeded = true;
  }

  // Whether we should start loading a new model on this frame
  // True if (1) model needs reloading and (2) no model is currently loading (or
  // if loading seems stuck)
  const reloadModelNow =
    reloadModelNeeded &&
    (modelLoadStarted === undefined || nowMillis - modelLoadStarted > 100);

  if (reloadModelNow) {
    modelLoadStarted = nowMillis;
    reloadModelNeeded = false;
    reloadModel(
      animations["height"].current,
      animations["outerRadius"].current,
      animations["wallThickness"].current,
      modelDimensions.closedBottom.latest,
    ).then(() => {
      modelLoadStarted = undefined;
      centerCameraNeeded = true;
    });
  }

  const canvasResized = renderer.resizeCanvas();

  if (canvasResized) {
    centerCameraNeeded = true;
  }

  if (centerCameraNeeded) {
    centerCamera();
    centerCameraNeeded = false;
  }

  renderer.render();
}

// performance.now() is equivalent to the timestamp supplied by
// requestAnimationFrame
//
// https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
loop(performance.now());
