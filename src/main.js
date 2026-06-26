import { Camera } from "./Camera.js";
import { Controls } from "./Controls.js";
import { LifeRenderer3D } from "./LifeRenderer3D.js";
import { LifeSimulation3D } from "./LifeSimulation3D.js";

const canvas = document.querySelector("#lifeCanvas");
const unsupported = document.querySelector("#unsupported");
const DEFAULT_SIMULATION_SPEED = 1;
const DEFAULT_AUTO_ROTATE = false;
const DEFAULT_GRID_DIMENSIONS = { x: 32, y: 32, z: 32 };
// const playPauseButton = document.querySelector("#playPause");
// const resetButton = document.querySelector("#reset");
// const speedInput = document.querySelector("#speed");
// const speedReadout = document.querySelector("#speedReadout");
// const autoRotateInput = document.querySelector("#autoRotate");
/*
const gridInputs = {
  x: document.querySelector("#gridX"),
  y: document.querySelector("#gridY"),
  z: document.querySelector("#gridZ"),
};
const applyGridButton = document.querySelector("#applyGrid");
*/

function showUnsupported(message) {
  unsupported.classList.add("visible");
  unsupported.querySelector("p").textContent = message;
}

function readGridInputs() {
  return { ...DEFAULT_GRID_DIMENSIONS };
}

/*
function writeGridOutputs(dimensions) {
  gridInputs.x.value = dimensions.x;
  gridInputs.y.value = dimensions.y;
  gridInputs.z.value = dimensions.z;
}
*/

async function init() {
  if (!navigator.gpu) {
    showUnsupported("WebGPU nao esta disponivel neste navegador. Use Chrome ou Edge em localhost.");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance",
  });

  if (!adapter) {
    showUnsupported("Nenhum adaptador WebGPU foi encontrado neste dispositivo.");
    return;
  }

  const device = await adapter.requestDevice();
  device.lost.then((info) => {
    showUnsupported(`Dispositivo WebGPU perdido: ${info.message || info.reason}`);
  });

  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: "opaque",
  });

  const camera = new Camera();
  const controls = new Controls(canvas, camera);
  const simulation = new LifeSimulation3D(device, readGridInputs());
  camera.fitToGrid(simulation.dimensions);
  const renderer = new LifeRenderer3D(device, context, canvas, format, simulation);
  // writeGridOutputs(simulation.dimensions);

  const playing = true;
  const speed = DEFAULT_SIMULATION_SPEED;
  const autoRotate = DEFAULT_AUTO_ROTATE;
  let accumulator = 0;
  let lastTime = performance.now();

  /*
  function rebuildSimulation() {
    const previous = simulation;
    simulation = new LifeSimulation3D(device, readGridInputs());
    renderer.setSimulation(simulation);
    camera.fitToGrid(simulation.dimensions);
    device.queue.onSubmittedWorkDone().then(() => previous.destroy()).catch(() => {});
    accumulator = 0;
    writeGridOutputs(simulation.dimensions);
  }
  */

  /*
  playPauseButton.addEventListener("click", () => {
    playing = !playing;
    playPauseButton.textContent = playing ? "Pausar" : "Play";
  });
  */

  /*
  resetButton.addEventListener("click", () => {
    simulation.randomize();
    accumulator = 0;
  });
  */

  /*
  speedInput.addEventListener("input", () => {
    speed = Number(speedInput.value);
    speedReadout.textContent = speed;
  });

  autoRotateInput.addEventListener("change", () => {
    autoRotate = autoRotateInput.checked;
  });
  */

  /*
  applyGridButton.addEventListener("click", rebuildSimulation);

  for (const input of Object.values(gridInputs)) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        rebuildSimulation();
      }
    });
  }
  */

  function frame(now) {
    const deltaTime = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    controls.update(deltaTime);

    const encoder = device.createCommandEncoder({ label: "Life frame encoder" });

    if (playing) {
      accumulator += deltaTime;
      const interval = 1 / speed;
      let stepsThisFrame = 0;

      while (accumulator >= interval && stepsThisFrame < 5) {
        simulation.encodeStep(encoder);
        accumulator -= interval;
        stepsThisFrame += 1;
      }

      if (stepsThisFrame === 5) {
        accumulator = 0;
      }
    }

    renderer.render(encoder, camera, deltaTime, now * 0.001, autoRotate);
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

init().catch((error) => {
  console.error(error);
  showUnsupported(error.message || "Falha ao iniciar a aplicacao WebGPU.");
});
