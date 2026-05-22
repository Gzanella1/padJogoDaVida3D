import { SIM_WORKGROUP_SIZE, simulationShader } from "./shaders/simulationShader.js";

const DEFAULT_RULES = {
  birth: 3,
  surviveMin: 2,
  surviveMax: 3,
};

function alignDimension(value, min, max) {
  const numeric = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

export class LifeSimulation3D {
  constructor(device, dimensions = { x: 24, y: 24, z: 16 }) {
    this.device = device;
    this.rules = { ...DEFAULT_RULES };
    this.currentStateIndex = 0;
    this.stepCount = 0;

    this.createPipeline();
    this.resize(dimensions);
  }

  createPipeline() {
    this.bindGroupLayout = this.device.createBindGroupLayout({
      label: "Life simulation bind group layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
      ],
    });

    const module = this.device.createShaderModule({
      label: "Life simulation shader",
      code: simulationShader,
    });

    this.pipeline = this.device.createComputePipeline({
      label: "Life simulation pipeline",
      layout: this.device.createPipelineLayout({
        label: "Life simulation pipeline layout",
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      compute: {
        module,
        entryPoint: "computeMain",
      },
    });
  }

  resize(dimensions) {
    this.destroyResources();

    const x = alignDimension(dimensions.x, 8, 64);
    const y = alignDimension(dimensions.y, 8, 64);
    const z = alignDimension(dimensions.z, 1, 48);
    this.dimensions = { x, y, z };
    this.total = x * y * z;
    this.currentStateIndex = 0;
    this.stepCount = 0;

    this.paramsBuffer = this.device.createBuffer({
      label: "Life simulation params",
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.writeParams();

    const stateBytes = this.total * Uint32Array.BYTES_PER_ELEMENT;
    this.stateBuffers = [
      this.device.createBuffer({
        label: "Life state A",
        size: stateBytes,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      this.device.createBuffer({
        label: "Life state B",
        size: stateBytes,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    ];

    this.bindGroups = [
      this.device.createBindGroup({
        label: "Life simulation bind group A to B",
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.paramsBuffer } },
          { binding: 1, resource: { buffer: this.stateBuffers[0] } },
          { binding: 2, resource: { buffer: this.stateBuffers[1] } },
        ],
      }),
      this.device.createBindGroup({
        label: "Life simulation bind group B to A",
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.paramsBuffer } },
          { binding: 1, resource: { buffer: this.stateBuffers[1] } },
          { binding: 2, resource: { buffer: this.stateBuffers[0] } },
        ],
      }),
    ];

    this.randomize();
  }

  writeParams() {
    const params = new Uint32Array([
      this.dimensions.x,
      this.dimensions.y,
      this.dimensions.z,
      this.total,
      this.rules.birth,
      this.rules.surviveMin,
      this.rules.surviveMax,
      0,
    ]);

    this.device.queue.writeBuffer(this.paramsBuffer, 0, params);
  }

  randomize() {
    const { x, y, z } = this.dimensions;
    const state = new Uint32Array(this.total);
    const density = z > 1 ? 0.24 : 0.32;
    const cx = (x - 1) * 0.5;
    const cy = (y - 1) * 0.5;
    const cz = Math.max((z - 1) * 0.5, 1);

    for (let zi = 0; zi < z; zi += 1) {
      for (let yi = 0; yi < y; yi += 1) {
        for (let xi = 0; xi < x; xi += 1) {
          const nx = (xi - cx) / Math.max(cx, 1);
          const ny = (yi - cy) / Math.max(cy, 1);
          const nz = (zi - cz) / cz;
          const radius = Math.hypot(nx, ny, nz);
          const bias = Math.max(0.22, 1 - radius * 0.28);
          const index = zi * x * y + yi * x + xi;
          state[index] = Math.random() < density * bias ? 1 : 0;
        }
      }
    }

    this.currentStateIndex = 0;
    this.stepCount = 0;
    this.device.queue.writeBuffer(this.stateBuffers[0], 0, state);
    this.device.queue.writeBuffer(this.stateBuffers[1], 0, new Uint32Array(this.total));
  }

  encodeStep(encoder) {
    const pass = encoder.beginComputePass({ label: "Life simulation pass" });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroups[this.currentStateIndex]);
    pass.dispatchWorkgroups(
      Math.ceil(this.dimensions.x / SIM_WORKGROUP_SIZE),
      Math.ceil(this.dimensions.y / SIM_WORKGROUP_SIZE),
      Math.ceil(this.dimensions.z / SIM_WORKGROUP_SIZE),
    );
    pass.end();

    this.currentStateIndex = 1 - this.currentStateIndex;
    this.stepCount += 1;
  }

  get currentStateBuffer() {
    return this.stateBuffers[this.currentStateIndex];
  }

  destroyResources() {
    if (!this.stateBuffers) {
      return;
    }

    for (const buffer of this.stateBuffers) {
      buffer.destroy();
    }

    this.paramsBuffer.destroy();
  }

  destroy() {
    this.destroyResources();
  }
}
