export class Controls {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.pointer = null;
    this.keys = new Set();

    this.bindEvents();
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) => {
      this.canvas.focus();
      this.pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        mode: event.button === 1 || event.button === 2 || event.shiftKey ? "pan" : "orbit",
      };
      this.canvas.setPointerCapture(event.pointerId);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.pointer || this.pointer.id !== event.pointerId) {
        return;
      }

      const dx = event.clientX - this.pointer.x;
      const dy = event.clientY - this.pointer.y;
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;

      if (this.pointer.mode === "pan") {
        this.camera.pan(dx, dy);
      } else {
        this.camera.orbit(dx, dy);
      }
    });

    this.canvas.addEventListener("pointerup", (event) => {
      if (this.pointer && this.pointer.id === event.pointerId) {
        this.pointer = null;
      }
    });

    this.canvas.addEventListener("pointercancel", () => {
      this.pointer = null;
    });

    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.camera.zoom(event.deltaY);
    }, { passive: false });

    this.canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    globalThis.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
    });

    globalThis.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });
  }

  update(deltaTime) {
    const horizontal = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    const forward = Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    const vertical = Number(this.keys.has("KeyE") || this.keys.has("PageUp")) -
      Number(this.keys.has("KeyQ") || this.keys.has("PageDown"));

    if (horizontal === 0 && forward === 0 && vertical === 0) {
      return;
    }

    const speed = this.camera.distance * 0.85 * deltaTime;
    this.camera.move(horizontal * speed, vertical * speed, forward * speed);
  }
}
