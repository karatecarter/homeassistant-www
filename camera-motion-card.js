class CameraMotionCard extends HTMLElement {
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

        const entityId = this.config.entity;
        const state = hass.states[entityId];

        if (state) {
            this.img.src = `${hass.hassUrl()}/api/camera_proxy/${entityId}`;
            this.hass = hass;
        }
    }

    setupEventListeners() {
        this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
        this.canvas.addEventListener("mousemove", (e) => this.draw(e));
        this.canvas.addEventListener("mouseup", () => this.stopDrawing());

        // Add window selection buttons
        const buttons = document.createElement("div");
        buttons.className = "window-buttons";
        for (let i = 1; i <= 4; i++) {
            const btn = document.createElement("button");
            btn.innerText = `Window ${i}`;
            btn.onclick = () => this.selectWindow(i);
            buttons.appendChild(btn);
        }
        this.appendChild(buttons);
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
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.strokeStyle = "red";
        this.ctx.lineWidth = 2;

        const width = currentX - this.startX;
        const height = currentY - this.startY;
        this.ctx.strokeRect(this.startX, this.startY, width, height);
    }

    stopDrawing() {
        if (!this.isDrawing) return;

        this.isDrawing = false;

        // Call service to update window coordinates
        this.hass.callService("camera", "set_window_coordinates", {
            entity_id: this.config.entity,
            window_num: this.currentWindow,
            x: Math.round(this.startX),
            y: Math.round(this.startY),
            x2: Math.round(this.currentX),
            y2: Math.round(this.currentY)
        });
    }

    selectWindow(num) {
        this.currentWindow = num;
        // You could add visual feedback for the selected window
    }
}

customElements.define("camera-motion-card", CameraMotionCard);

