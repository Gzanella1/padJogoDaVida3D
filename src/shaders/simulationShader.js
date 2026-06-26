export const SIM_WORKGROUP_SIZE = 4;

export const simulationShader = `
struct SimParams {
  grid: vec4u,
  rules: vec4u,
};

@group(0) @binding(0) var<uniform> params: SimParams;
@group(0) @binding(1) var<storage, read> stateIn: array<u32>;
@group(0) @binding(2) var<storage, read_write> stateOut: array<u32>;

fn wrappedGridIndex(xValue: i32, yValue: i32, zValue: i32) -> u32 {
  let gx = i32(params.grid.x);
  let gy = i32(params.grid.y);
  let gz = i32(params.grid.z);

  let x = (xValue + gx) % gx;
  let y = (yValue + gy) % gy;
  let z = (zValue + gz) % gz;

  return u32(z * gx * gy + y * gx + x);
}

fn cellActive(xValue: i32, yValue: i32, zValue: i32) -> u32 {
  return select(0u, 1u, stateIn[wrappedGridIndex(xValue, yValue, zValue)] > 0u);
}

@compute @workgroup_size(${SIM_WORKGROUP_SIZE}, ${SIM_WORKGROUP_SIZE}, ${SIM_WORKGROUP_SIZE})
fn computeMain(@builtin(global_invocation_id) cell: vec3u) {
  if (cell.x >= params.grid.x || cell.y >= params.grid.y || cell.z >= params.grid.z) {
    return;
  }

  let cx = i32(cell.x);
  let cy = i32(cell.y);
  let cz = i32(cell.z);
  var activeNeighbors = 0u;

  for (var dz = -1i; dz <= 1i; dz = dz + 1i) {
    for (var dy = -1i; dy <= 1i; dy = dy + 1i) {
      for (var dx = -1i; dx <= 1i; dx = dx + 1i) {
        if (dx == 0i && dy == 0i && dz == 0i) {
          continue;
        }

        activeNeighbors = activeNeighbors + cellActive(cx + dx, cy + dy, cz + dz);
      }
    }
  }

  let index = cell.z * params.grid.x * params.grid.y + cell.y * params.grid.x + cell.x;
  let age = stateIn[index];
  let alive = age > 0u;
  let born = activeNeighbors == params.rules.x;
  let survives = activeNeighbors >= params.rules.y && activeNeighbors <= params.rules.z;

  if (alive) {
    stateOut[index] = select(0u, min(age + 1u, 255u), survives);
  } else {
    stateOut[index] = select(0u, 1u, born);
  }
}
`;
