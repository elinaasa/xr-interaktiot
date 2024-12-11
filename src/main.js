import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(20, 20, 10);

let controller1, controller2;
let controllerGrip1, controllerGrip2;
let raycaster;
const intersected = [];
const tempMatrix = new THREE.Matrix4();
let group = new THREE.Group();
group.name = "Interaction-Group";

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
scene.add(hemisphereLight);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

new RGBELoader().load("./assets/environment2k.hdr", (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  scene.background = texture;
});

const maailmaGroup = new THREE.Group();
maailmaGroup.name = "Maailma Group";

const worldGroup = new THREE.Group();
scene.add(worldGroup);

worldGroup.add(maailmaGroup);

const interactablesGroup = new THREE.Group();
interactablesGroup.name = "Interactables Group";
worldGroup.add(interactablesGroup);

const gltfLoader = new GLTFLoader();

gltfLoader.load("./assets/maailma2.glb", (gltf) => {
  const model = gltf.scene;
  maailmaGroup.add(model);
});

gltfLoader.load("./assets/interactables.glb", (gltf) => {
  const model = gltf.scene;
  interactablesGroup.add(model);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

function initVR() {
  renderer.xr.enabled = true;
  document.body.appendChild(VRButton.createButton(renderer));

  controller1 = renderer.xr.getController(0);
  controller2 = renderer.xr.getController(1);

  scene.add(controller1);
  scene.add(controller2);

  const controllerModelFactory = new XRControllerModelFactory();
  controllerGrip1 = renderer.xr.getControllerGrip(0);
  controllerGrip2 = renderer.xr.getControllerGrip(1);

  controllerGrip1.add(
    controllerModelFactory.createControllerModel(controllerGrip1)
  );
  controllerGrip2.add(
    controllerModelFactory.createControllerModel(controllerGrip2)
  );

  scene.add(controllerGrip1);
  scene.add(controllerGrip2);

  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);
  const line1 = new THREE.Line(geometry);
  const line2 = new THREE.Line(geometry);
  line1.scale.z = line2.scale.z = 5;

  controller1.add(line1);
  controller2.add(line2);

  controller1.userData.line = line1;
  controller2.userData.line = line2;

  raycaster = new THREE.Raycaster();

  controller1.addEventListener("selectstart", onSelectStart);
  controller1.addEventListener("selectend", onSelectEnd);
  controller2.addEventListener("selectstart", onSelectStart);
  controller2.addEventListener("selectend", onSelectEnd);
}

function onSelectStart(event) {
  const controller = event.target;
  const intersections = getIntersections(controller);

  if (intersections.length > 0) {
    const intersection = intersections[0];
    const object = intersection.object;

    // Attach the object to the controller
    controller.attach(object);
    controller.userData.selected = object;
  }
}

function onSelectEnd(event) {
  const controller = event.target;

  if (controller.userData.selected !== undefined) {
    const object = controller.userData.selected;
    group.attach(object); // Return object to original group or scene

    controller.userData.selected = undefined;
  }
}

function getIntersections(controller) {
  controller.updateMatrixWorld();
  raycaster.updateFromXR(controller); // Use this method instead of setFromXRController
  return raycaster.intersectObjects(group.children, true);
}

function intersectObjects(controller) {
  if (
    controller.userData.targetRayMode === "screen" ||
    controller.userData.selected
  )
    return;

  const line = controller.userData.line;
  if (!line) return;

  const intersections = getIntersections(controller);

  if (intersections.length > 0) {
    const intersection = intersections[0];
    const object = intersection.object;
    object.traverse((node) => {
      if (node.material) {
        node.material.transparent = true;
        node.material.opacity = 0.5;
      }
    });
    intersected.push(object);
    line.scale.z = intersection.distance;
  } else {
    line.scale.z = 5;
  }
}

function cleanIntersected() {
  while (intersected.length) {
    const object = intersected.pop();
    object.traverse((node) => {
      if (node.material) {
        node.material.transparent = false;
        node.material.opacity = 1;
      }
    });
  }
}

renderer.setAnimationLoop(() => {
  cleanIntersected();
  intersectObjects(controller1);
  intersectObjects(controller2);
  renderer.render(scene, camera);
});

initVR();
