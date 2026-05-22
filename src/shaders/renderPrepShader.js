export const COMPACT_WORKGROUP_SIZE = 64;

export const indirectResetShader = `
struct DrawArgs {
  indexCount: u32,
  instanceCount: atomic<u32>,
  firstIndex: u32,
  baseVertex: u32,
  firstInstance: u32,
};

@group(0) @binding(0) var<storage, read_write> drawArgs: DrawArgs;

@compute @workgroup_size(1)
fn resetIndirect() {
  drawArgs.indexCount = 36u;
  atomicStore(&drawArgs.instanceCount, 0u);
  drawArgs.firstIndex = 0u;
  drawArgs.baseVertex = 0u;
  drawArgs.firstInstance = 0u;
}
`;

export const aliveCompactShader = `
struct SimParams {
  grid: vec4u,
  rules: vec4u,
};

struct DrawArgs {
  indexCount: u32,
  instanceCount: atomic<u32>,
  firstIndex: u32,
  baseVertex: u32,
  firstInstance: u32,
};

@group(0) @binding(0) var<uniform> params: SimParams;
@group(0) @binding(1) var<storage, read> state: array<u32>;
@group(0) @binding(2) var<storage, read_write> aliveCells: array<u32>;
@group(0) @binding(3) var<storage, read_write> drawArgs: DrawArgs;

@compute @workgroup_size(${COMPACT_WORKGROUP_SIZE})
fn compactAlive(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;

  if (index >= params.grid.w) {
    return;
  }

  let age = min(state[index], 255u);

  if (age > 0u) {
    let slot = atomicAdd(&drawArgs.instanceCount, 1u);
    aliveCells[slot] = (age << 24u) | index;
  }
}
`;
