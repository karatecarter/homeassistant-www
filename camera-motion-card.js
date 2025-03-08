class CameraMotionCard extends HTMLElement {
    constructor() {
        super();
        this.windowColors = {
            1: "#FF0000", // Red
            2: "#00FF00", // Green
            3: "#0000FF", // Blue
            4: "#FFA500"  // Orange
        };
        this.windows = {
            1: null,
            2: null,
            3: null,
            4: null
        };
    }

    static getConfigElement() {
        return document.createElement("camera-motion-card-editor");
    }

    static getStubConfig() {
        return { entity: "" }
    }

    setConfig(config) {
        if (!config.entity) {
            throw new Error("You need to define an entity");
        }
        this.config = config;
    }

    set hass(hass) {
        if (!this.content) {
            this.innerHTML = `
                <ha-card>
                    <div class="card-content">
                        <div id="camera-container" style="position: relative;">
                            <img id="camera-image" style="width: 100%;">
                            <canvas id="motion-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></canvas>
                        </div>
                    </div>
                </ha-card>
            `;

            this.img = this.querySelector("#camera-image");
            this.canvas = this.querySelector("#motion-overlay");
            this.ctx = this.canvas.getContext("2d");

            this.isDrawing = false;
            this.currentWindow = 0;

            this.setupEventListeners();
        }

        this._hass = hass;
        const entityId = this.config.entity;
        const state = hass.states[entityId];

        if (state) {
            const baseUrl = hass.hassUrl().endsWith('/') ? hass.hassUrl().slice(0, -1) : hass.hassUrl();
            const token = state.attributes.access_token || state.attributes.token;

            if (token) {
                this.img.src = `${baseUrl}/api/camera_proxy/${entityId}?token=${token}`;
            } else {
                this.img.src = `${baseUrl}/api/camera_proxy/${entityId}`;
            }

            this.img.onerror = () => {
                console.error(`Failed to load camera image for ${entityId}`);
                this.img.alt = "Camera image failed to load";
            };

            // Load window coordinates from state attributes if available
            for (let i = 1; i <= 4; i++) {
                if (state.attributes[`window_${i}_coordinates`]) {
                    const coords = state.attributes[`window_${i}_coordinates`];
                    this.windows[i] = coords;
                }
            }
        }
    }

    setupEventListeners() {
        this.img.onload = () => {
            this.canvas.width = this.img.clientWidth;
            this.canvas.height = this.img.clientHeight;
            this.drawAllWindows();
        };

        this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
        this.canvas.addEventListener("mousemove", (e) => this.draw(e));
        this.canvas.addEventListener("mouseup", () => this.stopDrawing());
        this.canvas.addEventListener("mouseleave", () => this.stopDrawing());

        const buttons = document.createElement("div");
        buttons.className = "window-buttons";
        buttons.style.marginTop = "8px";
        buttons.style.display = "flex";
        buttons.style.gap = "8px";

        for (let i = 1; i <= 4; i++) {
            const btn = document.createElement("button");
            btn.innerText = `Window ${i}`;
            btn.style.padding = "8px";
            btn.style.cursor = "pointer";
            btn.style.backgroundColor = this.windowColors[i];
            btn.style.color = "white";
            btn.style.border = "2px solid transparent"; // Add transparent border by default
            btn.style.borderRadius = "4px";
            btn.style.transition = "all 0.2s ease";
            btn.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.2)";
            btn.style.height = "36px"; // Fix the height
            btn.style.lineHeight = "16px"; // Ensure text is vertically centered
            btn.onclick = () => this.selectWindow(i);
            buttons.appendChild(btn);
        }
        this.querySelector(".card-content").appendChild(buttons);
    }

    drawAllWindows() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = 1; i <= 4; i++) {
            if (this.windows[i]) {
                const coords = this.windows[i];
                this.ctx.strokeStyle = this.windowColors[i];
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(
                    coords.x,
                    coords.y,
                    coords.x2 - coords.x,
                    coords.y2 - coords.y
                );
            }
        }
    }

    startDrawing(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.isDrawing = true;
        this.startX = e.clientX - rect.left;
        this.startY = e.clientY - rect.top;
    }

    draw(e) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        this.currentX = e.clientX - rect.left;
        this.currentY = e.clientY - rect.top;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawAllWindows();  // Redraw all existing windows

        if (this.currentWindow > 0) {
            this.ctx.strokeStyle = this.windowColors[this.currentWindow];
            this.ctx.lineWidth = 2;
            const width = this.currentX - this.startX;
            const height = this.currentY - this.startY;
            this.ctx.strokeRect(this.startX, this.startY, width, height);
        }
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this._hass && this.currentWindow > 0) {
            const coords = {
                x: Math.round(this.startX),
                y: Math.round(this.startY),
                x2: Math.round(this.currentX),
                y2: Math.round(this.currentY)
            };

            this.windows[this.currentWindow] = coords;

            this._hass.callService("icamera", "set_window_coordinates", {
                entity_id: this.config.entity,
                window_num: this.currentWindow,
                ...coords
            });

            this.drawAllWindows();
        }
    }

    selectWindow(num) {
        this.currentWindow = num;
        const buttons = this.querySelectorAll(".window-buttons button");
        buttons.forEach((btn, index) => {
            if (index + 1 === num) {
                btn.style.opacity = "1";
                btn.style.transform = "translateY(2px)";
                btn.style.boxShadow = "none";
                btn.style.borderColor = "rgba(0, 0, 0, 0.3)";
            } else {
                btn.style.opacity = "0.7";
                btn.style.transform = "none";
                btn.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.2)";
                btn.style.borderColor = "transparent";
            }
        });
    }
}

customElements.define("camera-motion-card", CameraMotionCard);

