import {
  add3,
  clamp,
  cross3,
  mat4LookAt,
  mat4Multiply,
  mat4Perspective,
  normalize3,
  scale3,
  sub3,
} from "./math.js";

export class Camera {
  constructor() {
    this.target = [0, 0, 0];
    this.distance = 58;
    this.minDistance = 8;
    this.maxDistance = 160;
    this.yaw = 0.78;
    this.pitch = 0.48;
    this.fov = Math.PI / 4;
  }

  fitToGrid(dimensions) {
    const largestAxis = Math.max(dimensions.x, dimensions.y, dimensions.z);
    this.target = [0, 0, 0];
    this.distance = largestAxis * 2.35;
    this.minDistance = largestAxis * 0.55;
    this.maxDistance = largestAxis * 6.5;
  }

  orbit(deltaX, deltaY) {
    this.yaw -= deltaX * 0.006;
    this.pitch = clamp(this.pitch - deltaY * 0.006, -1.34, 1.34);
  }

  zoom(deltaY) {
    this.distance = clamp(this.distance * Math.exp(deltaY * 0.001), this.minDistance, this.maxDistance);
  }

  pan(deltaX, deltaY) {
    const { right, up } = this.getBasis();
    const scale = this.distance * 0.0016;
    const horizontal = scale3(right, -deltaX * scale);
    const vertical = scale3(up, deltaY * scale);
    this.target = add3(this.target, add3(horizontal, vertical));
  }

  move(localRight, localUp, localForward) {
    const { right, up, forward } = this.getBasis();
    this.target = add3(
      this.target,
      add3(add3(scale3(right, localRight), scale3(up, localUp)), scale3(forward, localForward)),
    );
  }

  getPosition() {
    const cp = Math.cos(this.pitch);
    return [
      this.target[0] + Math.sin(this.yaw) * cp * this.distance,
      this.target[1] + Math.sin(this.pitch) * this.distance,
      this.target[2] + Math.cos(this.yaw) * cp * this.distance,
    ];
  }

  getBasis() {
    const eye = this.getPosition();
    const forward = normalize3(sub3(this.target, eye));
    const right = normalize3(cross3(forward, [0, 1, 0]));
    const up = normalize3(cross3(right, forward));
    return { forward, right, up };
  }

  getViewProjection(aspect) {
    const eye = this.getPosition();
    const view = mat4LookAt(eye, this.target, [0, 1, 0]);
    const projection = mat4Perspective(this.fov, aspect, 0.1, Math.max(300, this.maxDistance * 2.2));
    return mat4Multiply(projection, view);
  }
}
