export const renderShader = `
struct RenderUniforms {
  viewProjection: mat4x4f,
  model: mat4x4f,
  grid: vec4f,
  lightDirection: vec4f,
  cameraPosition: vec4f,
  time: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) normal: vec3f,
  @location(2) colorSeed: vec3f,
  @location(3) age: f32,
};

@group(0) @binding(0) var<uniform> uniforms: RenderUniforms;
@group(0) @binding(1) var<storage, read> aliveCells: array<u32>;

fn cellCoord(index: u32) -> vec3u {
  let gx = u32(uniforms.grid.x);
  let gy = u32(uniforms.grid.y);
  let plane = gx * gy;
  let z = index / plane;
  let rest = index - z * plane;
  let y = rest / gx;
  let x = rest - y * gx;
  return vec3u(x, y, z);
}

@vertex
fn vertexMain(input: VertexInput, @builtin(instance_index) instance: u32) -> VertexOutput {
  let packedCell = aliveCells[instance];
  let cellIndex = packedCell & 0x00ffffffu;
  let age = f32(packedCell >> 24u) / 255.0;
  let coord = cellCoord(cellIndex);
  let dims = uniforms.grid.xyz;
  let spacing = uniforms.grid.w;
  let centered = (vec3f(coord) - (dims - vec3f(1.0)) * 0.5) * spacing;
  let cubeScale = spacing * 0.42;
  let localPosition = centered + input.position * cubeScale;
  let world = uniforms.model * vec4f(localPosition, 1.0);
  let transformedNormal = uniforms.model * vec4f(input.normal, 0.0);

  var output: VertexOutput;
  output.position = uniforms.viewProjection * world;
  output.worldPosition = world.xyz;
  output.normal = normalize(transformedNormal.xyz);
  output.colorSeed = vec3f(coord) / max(dims - vec3f(1.0), vec3f(1.0));
  output.age = age;
  return output;
}

fn hsvToRgb(hue: f32, saturation: f32, value: f32) -> vec3f {
  let p = abs(fract(vec3f(hue) + vec3f(0.0, 0.6666667, 0.3333333)) * 6.0 - vec3f(3.0));
  let rgb = clamp(p - vec3f(1.0), vec3f(0.0), vec3f(1.0));
  return value * mix(vec3f(1.0), rgb, saturation);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let seed = input.colorSeed;
  let n = normalize(input.normal);
  let light = normalize(-uniforms.lightDirection.xyz);
  let viewDirection = normalize(uniforms.cameraPosition.xyz - input.worldPosition);

  let hue = fract(seed.x * 0.56 + seed.y * 0.31 + seed.z * 0.73 + input.age * 0.9);
  let newborn = 1.0 - smoothstep(0.0, 0.05, input.age);
  var base = hsvToRgb(hue, 0.96, 1.0);
  base = mix(base, vec3f(0.0, 1.0, 0.18), newborn * 0.62);

  let diffuse = max(dot(n, light), 0.0);
  let rim = pow(1.0 - clamp(dot(n, viewDirection), 0.0, 1.0), 2.2);
  let pulse = 0.72 + 0.28 * sin(uniforms.time.x * 3.2 + seed.x * 8.0 + seed.y * 5.0 + seed.z * 4.0);
  let ageGlow = 1.0 - smoothstep(0.1, 0.8, input.age);
  let volumeShade = 0.18 + diffuse * 0.72;
  let emissive = base * (0.46 + pulse * 0.34 + ageGlow * 0.32);
  let color = base * volumeShade + emissive + base * rim * 1.15;
  let alpha = 0.5 + pulse * 0.12 + ageGlow * 0.12;

  return vec4f(color, alpha);
}
`;
