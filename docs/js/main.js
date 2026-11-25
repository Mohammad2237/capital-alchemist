// Copyright (c) 2026 CAPITAL Team. All rights reserved. Proprietary — see LICENSE. Unauthorized copying or redistribution is prohibited.
// CAPITAL: The Alchemist's Legacy — three.js + WebXR edition (no Unity).
import * as THREE from "three";
import { setProgress } from "./assets.js";
import { buildShop, refs } from "./shop.js";
import { L } from "./layout.js";
import { Game } from "./game.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType("local-floor"); renderer.xr.setFramebufferScaleFactor(0.9);
renderer.domElement.id = "c"; renderer.domElement.tabIndex = 0;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x6b5248, 0.012);
// Dusk sky dome: warm horizon, violet zenith.
const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x3a3060) }, mid: { value: new THREE.Color(0xc77a52) }, low: { value: new THREE.Color(0x3b2c24) } },
  vertexShader: "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "uniform vec3 top, mid, low; varying vec3 p; void main(){ float h = p.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h*1.6,0.,1.),0.7)) : mix(mid, low, clamp(-h*4.,0.,1.)); gl_FragColor = vec4(c,1.0); }",
}));
scene.add(sky);
refs.hemi = new THREE.HemisphereLight(0x8a7fa0, 0x3a2a1c, 0.9); scene.add(refs.hemi);
const sun = new THREE.DirectionalLight(0xffb06b, 2.2);
sun.position.set(-8, 7, -14); sun.target.position.set(0, 0, 5);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 }); sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// Player rig: feet at rig origin; desktop eye height 1.62 m (in VR the headset sets the height).
const rig = new THREE.Group(); rig.name = "Player";
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 300);
camera.position.y = 1.62; rig.add(camera); scene.add(rig);
rig.position.copy(L.outsideStart); rig.rotation.y = L.outsideYaw;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const fill = document.getElementById("bar-fill"), pct = document.getElementById("pct");
setProgress(p => { fill.style.width = (p * 100) + "%"; pct.textContent = Math.round(p * 100) + "%"; });

const clock = new THREE.Clock();
let game;
(async () => {
  try {
    await buildShop(scene);
    game = new Game({ renderer, scene, camera, rig, sun });
    await game.init();
  } catch (e) {
    console.error(e);
    document.getElementById("loading-text").textContent = "تعذّر تحميل المتجر: " + e.message;
    return;
  }
  document.getElementById("loading").classList.add("done");
  document.getElementById("hud").hidden = false;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    for (const f of refs.flickers) f.l.intensity = f.base * (0.86 + 0.24 * noise(f.seed, t * 2.2));
    for (const f of refs.flames) f.m.scale.copy(f.base).multiplyScalar(1 + Math.sin(t * 7 + f.seed * 3) * 0.08);
    game.update(dt, t);
    renderer.render(scene, camera);
  });
  window.__capital = game; // handy for automated checks
  const BUILD = "إصدار r13"; game.ui.build = BUILD; const k = document.getElementById("keys"); k.textContent += "  •  " + BUILD;
  const sm = new URLSearchParams(location.search).get("smoke");
  if (sm !== null) import("./smoke.js").then(m => m.runSmoke(game, +sm)).catch(e => { window.__smoke = { failed: 1, log: ["FAIL " + e.message] }; document.title = "SMOKE FAIL"; console.error(e); });
})();

function noise(seed, t) { return 0.5 + 0.25 * Math.sin(t * 1.7 + seed) + 0.25 * Math.sin(t * 2.9 + seed * 1.3); }
