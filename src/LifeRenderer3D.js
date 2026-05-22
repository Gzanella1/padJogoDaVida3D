import { mat4RotationXYZ } from "./math.js";
import { renderShader } from "./shaders/renderShader.js";
import {
  aliveCompactShader,
  COMPACT_WORKGROUP_SIZE,
  indirectResetShader,
} from "./shaders/renderPrepShader.js";

const RENDER_UNIFORM_FLOATS = 48;
const DEPTH_FORMAT = "depth24plus";

function createCubeGeometry() {
  const faces = [
    { normal: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { normal: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { normal: [1, 0, 0], corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { normal: [-1, 0, 0], corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
    { normal: [0, 1, 0], corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { normal: [0, -1, 0], corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  ];
  const vertexData = [];
  const indices = [];

  for (const face of faces) {
    const vertexOffset = vertexData.length / 6;

    for (const corner of face.corners) {
      vertexData.push(...corner, ...face.normal);
    }

    indices.push(
      vertexOffset,
      vertexOffset + 1,
      vertexOffset + 2,
      vertexOffset,
      vertexOffset + 2,
      vertexOffset + 3,
    );
  }

  return {
    vertices: new Float32Array(vertexData),
    indices: new Uint16Array(indices),
  };
}

export class LifeRenderer3D {
  constructor(device, context, canvas, format, simulation) {
    this.device = device;
    this.context = context;
    this.canvas = canvas;
    this.format = format;
    this.sceneRotation = [0.55, 0.2, 0.1];
    this.pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);

    this.createGeometry();
    this.createPipelines();
    this.setSimulation(simulation);
  }

  createGeometry() {
    const geometry = createCubeGeometry();
    this.indexCount = geometry.indices.length;

    this.vertexBuffer = this.device.createBuffer({
      label: "Cube vertex buffer",
      size: geometry.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.vertexBuffer, 0, geometry.vertices);

    this.indexBuffer = this.device.createBuffer({
      label: "Cube index buffer",
      size: geometry.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.indexBuffer, 0, geometry.indices);
  }

  createPipelines() {
    this.renderUniformBuffer = this.device.createBuffer({
      label: "Render uniforms",
      size: RENDER_UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.renderBindGroupLayout = this.device.createBindGroupLayout({
      label: "Life render bind group layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
      ],
    });

    const shaderModule = this.device.createShaderModule({
      label: "Life cube render shader",
      code: renderShader,
    });

    this.renderPipeline = this.device.createRenderPipeline({
      label: "Life cube render pipeline",
      layout: this.device.createPipelineLayout({
        label: "Life render pipeline layout",
        bindGroupLayouts: [this.renderBindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 12, format: "float32x3" },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        format: DEPTH_FORMAT,
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });

    this.resetBindGroupLayout = this.device.createBindGroupLayout({
      label: "Indirect reset bind group layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
      ],
    });

    this.compactBindGroupLayout = this.device.createBindGroupLayout({
      label: "Alive compact bind group layout",
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
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
      ],
    });

    this.resetPipeline = this.device.createComputePipeline({
      label: "Indirect reset pipeline",
      layout: this.device.createPipelineLayout({
        label: "Indirect reset pipeline layout",
        bindGroupLayouts: [this.resetBindGroupLayout],
      }),
      compute: {
        module: this.device.createShaderModule({
          label: "Indirect reset shader",
          code: indirectResetShader,
        }),
        entryPoint: "resetIndirect",
      },
    });

    this.compactPipeline = this.device.createComputePipeline({
      label: "Alive compact pipeline",
      layout: this.device.createPipelineLayout({
        label: "Alive compact pipeline layout",
        bindGroupLayouts: [this.compactBindGroupLayout],
      }),
      compute: {
        module: this.device.createShaderModule({
          label: "Alive compact shader",
          code: aliveCompactShader,
        }),
        entryPoint: "compactAlive",
      },
    });
  }

  setSimulation(simulation) {
    this.simulation = simulation;
    this.createAliveResources(simulation.total);

    this.compactBindGroups = simulation.stateBuffers.map((buffer, index) => this.device.createBindGroup({
      label: `Alive compact bind group ${index}`,
      layout: this.compactBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: simulation.paramsBuffer } },
        { binding: 1, resource: { buffer } },
        { binding: 2, resource: { buffer: this.aliveCellsBuffer } },
        { binding: 3, resource: { buffer: this.indirectBuffer } },
      ],
    }));
  }

  createAliveResources(totalCells) {
    const oldAliveCellsBuffer = this.aliveCellsBuffer;
    const oldIndirectBuffer = this.indirectBuffer;

    this.aliveCellsBuffer = this.device.createBuffer({
      label: "Alive cell index buffer",
      size: totalCells * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE,
    });

    this.indirectBuffer = this.device.createBuffer({
      label: "Alive draw indirect buffer",
      size: 5 * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT,
    });

    this.resetBindGroup = this.device.createBindGroup({
      label: "Indirect reset bind group",
      layout: this.resetBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.indirectBuffer } },
      ],
    });

    this.renderBindGroup = this.device.createBindGroup({
      label: "Life cube render bind group",
      layout: this.renderBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.renderUniformBuffer } },
        { binding: 1, resource: { buffer: this.aliveCellsBuffer } },
      ],
    });

    if (oldAliveCellsBuffer && oldIndirectBuffer) {
      this.device.queue.onSubmittedWorkDone().then(() => {
        oldAliveCellsBuffer.destroy();
        oldIndirectBuffer.destroy();
      }).catch(() => {});
    }
  }

  resize() {
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * this.pixelRatio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * this.pixelRatio));

    if (this.canvas.width === width && this.canvas.height === height && this.depthTexture) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;

    if (this.depthTexture) {
      this.depthTexture.destroy();
    }

    this.depthTexture = this.device.createTexture({
      label: "Life depth texture",
      size: [width, height],
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  updateUniforms(camera, deltaTime, elapsedSeconds, autoRotate) {
    if (autoRotate) {
      this.sceneRotation[0] += deltaTime * 0.31;
      this.sceneRotation[1] += deltaTime * 0.43;
      this.sceneRotation[2] += deltaTime * 0.19;
    }

    const aspect = this.canvas.width / this.canvas.height;
    const viewProjection = camera.getViewProjection(aspect);
    const model = mat4RotationXYZ(this.sceneRotation[0], this.sceneRotation[1], this.sceneRotation[2]);
    const cameraPosition = camera.getPosition();
    const uniforms = new Float32Array(RENDER_UNIFORM_FLOATS);
    const { x, y, z } = this.simulation.dimensions;

    uniforms.set(viewProjection, 0);
    uniforms.set(model, 16);
    uniforms.set([x, y, z, 1.08], 32);
    uniforms.set([-0.38, 0.72, 0.54, 0], 36);
    uniforms.set([cameraPosition[0], cameraPosition[1], cameraPosition[2], 0], 40);
    uniforms.set([elapsedSeconds, 0, 0, 0], 44);

    this.device.queue.writeBuffer(this.renderUniformBuffer, 0, uniforms);
  }

  encodeAliveCompaction(encoder) {
    const resetPass = encoder.beginComputePass({ label: "Reset indirect draw pass" });
    resetPass.setPipeline(this.resetPipeline);
    resetPass.setBindGroup(0, this.resetBindGroup);
    resetPass.dispatchWorkgroups(1);
    resetPass.end();

    const compactPass = encoder.beginComputePass({ label: "Compact alive cells pass" });
    compactPass.setPipeline(this.compactPipeline);
    compactPass.setBindGroup(0, this.compactBindGroups[this.simulation.currentStateIndex]);
    compactPass.dispatchWorkgroups(Math.ceil(this.simulation.total / COMPACT_WORKGROUP_SIZE));
    compactPass.end();
  }

  render(encoder, camera, deltaTime, elapsedSeconds, autoRotate) {
    this.resize();
    this.updateUniforms(camera, deltaTime, elapsedSeconds, autoRotate);
    this.encodeAliveCompaction(encoder);

    const pass = encoder.beginRenderPass({
      label: "Life cube render pass",
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          loadOp: "clear",
          clearValue: { r: 0.006, g: 0.018, b: 0.065, a: 1 },
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthLoadOp: "clear",
        depthClearValue: 1,
        depthStoreOp: "store",
      },
    });

    pass.setPipeline(this.renderPipeline);
    pass.setBindGroup(0, this.renderBindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, "uint16");
    pass.drawIndexedIndirect(this.indirectBuffer, 0);
    pass.end();
  }
}
