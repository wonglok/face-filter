import {
  WebGLRenderer,
  PCFSoftShadowMap,
  sRGBEncoding,
  Scene,
  SpotLight,
  PerspectiveCamera,
  HemisphereLight,
  AmbientLight,
  IcosahedronGeometry,
  OrthographicCamera,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  TextureLoader,
  MeshStandardMaterial,
  VideoTexture,
  Color,
  MeshPhongMaterial,
  ShaderMaterial,
  Vector3,
  Euler,
} from "../../third_party/three.module.js";
import { FaceMeshFaceGeometry } from "../../js/face.js";
import { OrbitControls } from "../../third_party/OrbitControls.js";

const av = document.querySelector("gum-av");
const canvas = document.querySelector("canvas");
const status = document.querySelector("#status");

// Set a background color, or change alpha to false for a solid canvas.
const renderer = new WebGLRenderer({ antialias: true, alpha: true, canvas });
// renderer.setClearColor(0x202020);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.outputEncoding = sRGBEncoding;

const scene = new Scene();
const camera = new OrthographicCamera(1, 1, 1, 1, -1000, 1000);

// Change to renderer.render(scene, debugCamera); for interactive view.
const debugCamera = new PerspectiveCamera(75, 1, 0.1, 1000);
debugCamera.position.set(300, 300, 300);
debugCamera.lookAt(scene.position);
const controls = new OrbitControls(debugCamera, renderer.domElement);

let width = 0;
let height = 0;

function resize() {
  const videoAspectRatio = width / height;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const windowAspectRatio = windowWidth / windowHeight;
  let adjustedWidth;
  let adjustedHeight;
  if (videoAspectRatio > windowAspectRatio) {
    adjustedWidth = windowWidth;
    adjustedHeight = windowWidth / videoAspectRatio;
  } else {
    adjustedWidth = windowHeight * videoAspectRatio;
    adjustedHeight = windowHeight;
  }
  renderer.setSize(adjustedWidth, adjustedHeight);
  debugCamera.aspect = videoAspectRatio;
  debugCamera.updateProjectionMatrix();
}

window.addEventListener("resize", () => {
  resize();
});
resize();
renderer.render(scene, camera);

// Load textures for mask material.
const colorTexture = new TextureLoader().load("../../assets/mesh_map.jpg");
const aoTexture = new TextureLoader().load("../../assets/ao.jpg");
const alphaTexture = new TextureLoader().load(
  "../../assets/mask_watermark.png"
);

// Create wireframe material for debugging.
const wireframeMaterial = new MeshBasicMaterial({
  color: 0xff00ff,
  wireframe: true,
});

// Create material for mask.
const material = new ShaderMaterial({
  // roughness: 1.0,
  // metalness: 0.0,
  // color: 0x808080,
  // roughness: 0.8,
  // metalness: 0.1,
  // alphaMap: alphaTexture,
  // aoMap: aoTexture,
  // map: colorTexture,

  // roughnessMap: colorTexture,
  transparent: true,
  side: DoubleSide,

  uniforms: {
    alphaMap: { value: alphaTexture },
    video: { value: colorTexture },
    time: { value: 0 },
    faceRotation: { value: new Euler() },
    tint: { value: new Color("#fff800") },
    intensity: { value: 3.2 },
  },
  vertexShader: `
  varying vec2 vUv;
  varying vec3 vNormal;

  varying vec2 vMaskUv;
  attribute vec2 maskUV;
    void main (void) {
        vUv = uv;
        vMaskUv = maskUV;
        vNormal = normalMatrix * normal;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    }
  `,
  fragmentShader: `

  //
  varying vec2 vMaskUv;
  varying vec2 vUv;
  uniform sampler2D video;
  uniform sampler2D alphaMap;

  varying vec3 vNormal;
  uniform float time;
  uniform vec3 faceRotation;

  uniform vec3 tint;
  uniform float intensity;

  ${getLib()}

  void main (void) {
    vec4 faceColor = texture2D(video, vUv);
    vec4 alphaMaskColor = texture2D(alphaMap, vMaskUv);

    float alphaMaskFade = (alphaMaskColor.r + alphaMaskColor.g + alphaMaskColor.b) / 3.0;

    // vec3 rainbow = vec3(
    //   pattern(vNormal.rg * 1.70123 + -0.17 * cos(time * 0.05)),
    //   pattern(vNormal.gb * 1.70123 +  0.0 * cos(time * 0.05)),
    //   pattern(vNormal.br * 1.70123 +  0.17 * cos(time * 0.05))
    // );

    float maskFader = 1.0 - length((vMaskUv - 0.5) * 2.0);
    float smoothAlphaMasking = pow(maskFader, 1.5 - maskFader) * (1.0 - maskFader);
    smoothAlphaMasking = smoothAlphaMasking * intensity;

    float fbmFader = pattern((vNormal.yz) * 1.333 * 1.70123 + cos(time * 0.05));
    float cnoiseFader = abs(cnoise((faceColor.xyz + time * 0.53) * 1.333 * 1.70123 + cos(time * 0.05))) * 5.0;

    // float bb = 1.0 / 255.0;
    // vec3 golden = vec3(255.0 * bb, 255.0 * bb, 84.0 * bb);
    // vec3 cyan  = vec3(96.0 * bb, 255.0 * bb, 227.0 * bb);
    // vec3 pasturegreen  = vec3(0.0 * bb, 160.0 * bb, 87.0 * bb);

    vec3 taintColor = tint;
    gl_FragColor = vec4(faceColor.rgb + vec3(fbmFader * cnoiseFader) * taintColor * smoothAlphaMasking, alphaMaskFade * smoothAlphaMasking);
  }
  `,
});

// let material = new MeshBasicMaterial({
//   map: colorTexture,
//   transparent: true,
//   color: new Color("#ff0000"),
// });

// Create a new geometry helper.
const faceGeometry = new FaceMeshFaceGeometry({
  useVideoTexture: true,
});

const Paramteres = {
  intensity: material.uniforms.intensity.value,
  tint: "#ffff00",
};

const pane = new Tweakpane.Pane();

pane.addInput(Paramteres, "intensity").on("change", (ev) => {
  material.uniforms.intensity.value = ev.value;
});
pane
  .addInput(Paramteres, "tint", {
    picker: "inline",
    expanded: true,
  })
  .on("change", (ev) => {
    //
    material.uniforms.tint.value.set(ev.value);
  });

// Create mask mesh.
const mask = new Mesh(faceGeometry, material);
scene.add(mask);
// mask.receiveShadow = mask.castShadow = true;

// Add lights.
const spotLight = new SpotLight(0xffffbb, 1);
spotLight.position.set(0.5, 0.5, 1);
spotLight.position.multiplyScalar(400);
scene.add(spotLight);

spotLight.castShadow = true;

spotLight.shadow.mapSize.width = 1024;
spotLight.shadow.mapSize.height = 1024;

spotLight.shadow.camera.near = 200;
spotLight.shadow.camera.far = 800;

spotLight.shadow.camera.fov = 40;

spotLight.shadow.bias = -0.001125;

scene.add(spotLight);

const hemiLight = new HemisphereLight(0xffffbb, 0x080820, 0.25);
scene.add(hemiLight);

const ambientLight = new AmbientLight(0x404040, 0.25);
scene.add(ambientLight);

// Create a red material for the nose.
const noseMaterial = new MeshStandardMaterial({
  color: 0xff2010,
  roughness: 0.4,
  metalness: 0.1,
  transparent: true,
});

const nose = new Mesh(new IcosahedronGeometry(1, 3), noseMaterial);
nose.castShadow = nose.receiveShadow = true;
scene.add(nose);
nose.scale.setScalar(1);
// nose.scale.setScalar(40);

// Enable wireframe to debug the mesh on top of the material.
let wireframe = false;

// Defines if the source should be flipped horizontally.
let flipCamera = true;

async function render(model) {
  // Wait for video to be ready (loadeddata).
  await av.ready();

  // Flip video element horizontally if necessary.
  av.video.style.transform = flipCamera ? "scaleX(-1)" : "scaleX(1)";

  // Resize orthographic camera to video dimensions if necessary.
  if (width !== av.video.videoWidth || height !== av.video.videoHeight) {
    const w = av.video.videoWidth;
    const h = av.video.videoHeight;
    camera.left = -0.5 * w;
    camera.right = 0.5 * w;
    camera.top = 0.5 * h;
    camera.bottom = -0.5 * h;
    camera.updateProjectionMatrix();
    width = w;
    height = h;
    resize();
    faceGeometry.setSize(w, h);
  }

  //

  // Wait for the model to return a face.
  const faces = await model.estimateFaces(av.video, false, flipCamera);

  av.style.opacity = 1;
  status.textContent = "";

  // There's at least one face.
  if (faces.length > 0) {
    // Update face mesh geometry with new data.
    faceGeometry.update(faces[0], flipCamera);

    // track the nose
    // Modify nose position and orientation.
    const track = faceGeometry.track(5, 45, 275);
    nose.position.copy(track.position);
    nose.rotation.setFromRotationMatrix(track.rotation);

    material.uniforms.faceRotation.value.setFromRotationMatrix(track.rotation);
  }

  material.uniforms.time.value = window.performance.now() / 1000;

  if (wireframe) {
    // Render the mask.
    renderer.render(scene, camera);
    // Prevent renderer from clearing the color buffer.
    renderer.autoClear = false;
    renderer.clear(false, true, false);
    mask.material = wireframeMaterial;
    // Render again with the wireframe material.
    renderer.render(scene, camera);
    mask.material = material;
    renderer.autoClear = true;
  } else {
    // Render the scene normally.
    renderer.render(scene, camera);
  }

  requestAnimationFrame(() => render(model));
}

// Init the demo, loading dependencies.
async function init() {
  await Promise.all([tf.setBackend("webgl"), av.ready()]);
  status.textContent = "Loading model...";

  try {
    const model = await facemesh.load({ maxFaces: 1 });
    status.textContent = "Detecting face...";

    const videoTexture = new VideoTexture(av.video);
    videoTexture.encoding = sRGBEncoding;
    material.uniforms.video.value = videoTexture;

    render(model);
  } catch (e) {
    status.textContent = "請用 iOS Safari 或者 Android Chrome 開啟";
  }
}

init();

function getLib() {
  return /* glsl */ `


  const mat2 m = mat2( 0.80,  0.60, -0.60,  0.80 );

  float noise( in vec2 p ) {
    return sin(p.x)*sin(p.y);
  }

  float fbm4( vec2 p ) {
      float f = 0.0;
      f += 0.5000 * noise( p ); p = m * p * 2.02;
      f += 0.2500 * noise( p ); p = m * p * 2.03;
      f += 0.1250 * noise( p ); p = m * p * 2.01;
      f += 0.0625 * noise( p );
      return f / 0.9375;
  }

  float fbm6( vec2 p ) {
      float f = 0.0;
      f += 0.500000*(0.5 + 0.5 * noise( p )); p = m*p*2.02;
      f += 0.250000*(0.5 + 0.5 * noise( p )); p = m*p*2.03;
      f += 0.125000*(0.5 + 0.5 * noise( p )); p = m*p*2.01;
      f += 0.062500*(0.5 + 0.5 * noise( p )); p = m*p*2.04;
      f += 0.031250*(0.5 + 0.5 * noise( p )); p = m*p*2.01;
      f += 0.015625*(0.5 + 0.5 * noise( p ));
      return f/0.96875;
  }

  float pattern (vec2 p) {
    float vout = fbm4( p + time + fbm6(  p + fbm4( p + time )) );
    return abs(vout);
  }

  //	Classic Perlin 3D Noise
  //	by Stefan Gustavson
  //
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

  float cnoise(vec3 P){
    vec3 Pi0 = floor(P); // Integer part for indexing
    vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P); // Fractional part for interpolation
    vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
  }
  `;
}
