import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class CameraMotionCard extends HTMLElement {
    constructor() {
        super();
        this.windowColors = {
            1: "#FF0000", // Red
            2: "#2E7D32", // Green
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
        return document.createElement('camera-motion-card-editor');
    }

    static getStubConfig() {
        return {
            type: "custom:camera-motion-card",
            entity: ""
        };
    }

    setConfig(config) {
        if (!config.entity) {
            throw new Error('Please define an entity');
        }
        this.config = config;
    }

    set hass(hass) {
        if (!this.innerHTML) {
            this.innerHTML = `
                <ha-card>
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <div class="name"></div>
                        <ha-icon-button>
                            <ha-icon icon="mdi:refresh"></ha-icon>
                        </ha-icon-button>
                    </div>
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
            this.refreshButton = this.querySelector("ha-icon-button");

            this.isDrawing = false;
            this.currentWindow = 0;

            // Setup refresh button click handler
            this.refreshButton.addEventListener("click", () => {
                this.loadCameraImage(this._hass);
            });

            this.setupEventListeners();
        }

        // Only update hass reference and load image if it's the first time
        if (!this._hass) {
            this._hass = hass;

        } else {
            this._hass = hass;
        }
        this.loadCameraImage(hass);
        // Update window data from state attributes
        const entityId = this.config.entity;
        const state = hass.states[entityId];
        if (state) {
            // Update name in header
            const nameDiv = this.querySelector(".name");
            if (nameDiv) {
                nameDiv.textContent = state.attributes.friendly_name || entityId;
            }

            // Load window data from state attributes
            for (let i = 1; i <= 4; i++) {
                const windowData = state.attributes[`window_${i}`];
                if (windowData) {
                    this.windows[i] = windowData;
                }
            }

            // Update button labels and styles if they exist
            const buttons = this.querySelectorAll(".window-buttons button");
            buttons.forEach((btn, index) => {
                const windowNum = index + 1;
                const windowData = this.windows[windowNum];
                if (windowData) {
                    btn.innerText = windowData.name || `Window ${windowNum}`;
                    if (windowData.is_on) {
                        btn.style.opacity = "1";
                    } else {
                        btn.style.opacity = "0.3";
                    }
                }
            });

            this.drawAllWindows();
        }
    }

    loadCameraImage(hass) {
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
            const windowData = this.windows[i];
            btn.innerText = windowData?.name || `Window ${i}`;
            btn.style.padding = "8px";
            btn.style.cursor = "pointer";
            btn.style.backgroundColor = this.windowColors[i];
            btn.style.color = "white";
            btn.style.border = "2px solid transparent";
            btn.style.borderRadius = "4px";
            btn.style.transition = "all 0.2s ease";
            btn.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.2)";
            btn.style.height = "36px";
            btn.style.lineHeight = "16px";
            btn.style.opacity = windowData?.is_on ? "1" : "0.3";
            btn.onclick = () => this.selectWindow(i);
            buttons.appendChild(btn);
        }
        this.querySelector(".card-content").appendChild(buttons);

        // Add settings panel
        const settingsPanel = document.createElement("div");
        settingsPanel.className = "window-settings";
        settingsPanel.style.marginTop = "16px";
        settingsPanel.style.display = "none"; // Hide initially
        settingsPanel.style.gap = "8px";
        settingsPanel.style.padding = "12px";
        settingsPanel.style.backgroundColor = "rgba(var(--rgb-primary-text-color), 0.06)";
        settingsPanel.style.borderRadius = "4px";

        // Create enable/disable checkbox
        const enableContainer = document.createElement("div");
        enableContainer.style.display = "flex";
        enableContainer.style.alignItems = "center";
        enableContainer.style.marginBottom = "12px";

        const enableCheckbox = document.createElement("ha-switch");
        enableCheckbox.style.marginRight = "8px";

        const enableLabel = document.createElement("span");
        enableLabel.textContent = "Enable Window";

        enableContainer.appendChild(enableCheckbox);
        enableContainer.appendChild(enableLabel);

        // Create settings inputs
        const nameInput = document.createElement("ha-textfield");
        nameInput.label = "Window Name";
        nameInput.style.marginBottom = "8px";
        nameInput.style.width = "100%";
        nameInput.value = `Window ${this.currentWindow || 1}`;

        const sensitivitySlider = document.createElement("ha-slider");
        sensitivitySlider.min = 0;
        sensitivitySlider.max = 10;
        sensitivitySlider.pin = true;
        sensitivitySlider.style.marginBottom = "8px";

        const sensitivityLabel = document.createElement("div");
        sensitivityLabel.textContent = "Sensitivity: 0";
        sensitivityLabel.style.marginBottom = "4px";

        const thresholdSlider = document.createElement("ha-slider");
        thresholdSlider.min = 0;
        thresholdSlider.max = 255;
        thresholdSlider.pin = true;
        thresholdSlider.style.marginBottom = "8px";

        const thresholdLabel = document.createElement("div");
        thresholdLabel.textContent = "Threshold: 0";
        thresholdLabel.style.marginBottom = "4px";

        // Add event listeners for settings changes
        enableCheckbox.addEventListener("change", (e) => {
            if (this.currentWindow && this._hass) {
                const isEnabled = e.target.checked;
                this._hass.callService("icamera", "set_window_enabled", {
                    entity_id: this.config.entity,
                    window_num: this.currentWindow,
                    enabled: isEnabled
                });
                // Update local state
                if (!this.windows[this.currentWindow]) {
                    this.windows[this.currentWindow] = {};
                }
                this.windows[this.currentWindow].is_on = isEnabled;
                // Update button appearance
                const btn = this.querySelector(`.window-buttons button:nth-child(${this.currentWindow})`);
                if (btn) {
                    btn.style.opacity = isEnabled ? "1" : "0.4";
                }
            }
        });

        nameInput.addEventListener("change", (e) => {
            if (this.currentWindow && this._hass) {
                this._hass.callService("icamera", "set_window_name", {
                    entity_id: this.config.entity,
                    window_num: this.currentWindow,
                    name: e.target.value
                });
                // Update button text
                const btn = this.querySelector(`.window-buttons button:nth-child(${this.currentWindow})`);
                if (btn) btn.innerText = e.target.value || `Window ${this.currentWindow}`;
                // Update local state
                if (!this.windows[this.currentWindow]) {
                    this.windows[this.currentWindow] = {};
                }
                this.windows[this.currentWindow].name = e.target.value;
            }
        });

        sensitivitySlider.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            sensitivityLabel.textContent = `Sensitivity: ${value}`;
        });

        sensitivitySlider.addEventListener("change", (e) => {
            if (this.currentWindow && this._hass) {
                const value = parseInt(e.target.value);
                this._hass.callService("icamera", "set_window_sensitivity", {
                    entity_id: this.config.entity,
                    window_num: this.currentWindow,
                    sensitivity: value
                });
                // Update local state
                if (!this.windows[this.currentWindow]) {
                    this.windows[this.currentWindow] = {};
                }
                this.windows[this.currentWindow].sensitivity = value;
            }
        });

        thresholdSlider.addEventListener("change", (e) => {
            if (this.currentWindow && this._hass) {
                const value = parseInt(e.target.value);
                thresholdLabel.textContent = `Threshold: ${value}`;
                this._hass.callService("icamera", "set_window_threshold", {
                    entity_id: this.config.entity,
                    window_num: this.currentWindow,
                    threshold: value
                });
                // Update local state
                if (!this.windows[this.currentWindow]) {
                    this.windows[this.currentWindow] = {};
                }
                this.windows[this.currentWindow].threshold = value;
            }
        });

        // Add elements to settings panel
        settingsPanel.appendChild(enableContainer);
        settingsPanel.appendChild(nameInput);
        settingsPanel.appendChild(sensitivityLabel);
        settingsPanel.appendChild(sensitivitySlider);
        settingsPanel.appendChild(thresholdLabel);
        settingsPanel.appendChild(thresholdSlider);

        this.querySelector(".card-content").appendChild(settingsPanel);
        this.settingsPanel = settingsPanel;
        this.enableCheckbox = enableCheckbox;
        this.nameInput = nameInput;
        this.sensitivitySlider = sensitivitySlider;
        this.sensitivityLabel = sensitivityLabel;
        this.thresholdSlider = thresholdSlider;
        this.thresholdLabel = thresholdLabel;
    }

    translateToDisplayCoords(x, y) {
        const scaleX = this.canvas.width / 640;
        const scaleY = this.canvas.height / 480;
        return {
            x: Math.round(x * scaleX),
            y: Math.round(y * scaleY)
        };
    }

    translateToCameraCoords(x, y) {
        const scaleX = 640 / this.canvas.width;
        const scaleY = 480 / this.canvas.height;
        return {
            x: Math.round(x * scaleX),
            y: Math.round(y * scaleY)
        };
    }

    drawAllWindows() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = 1; i <= 4; i++) {
            const windowData = this.windows[i];
            if (windowData && windowData.coordinates) {
                const coords = windowData.coordinates;
                // Translate camera coordinates to display coordinates
                const start = this.translateToDisplayCoords(coords.x, coords.y);
                const end = this.translateToDisplayCoords(coords.x2, coords.y2);

                this.ctx.strokeStyle = this.windowColors[i];
                this.ctx.lineWidth = windowData.is_on ? 2 : 1;
                this.ctx.globalAlpha = windowData.is_on ? 1 : 0.5;
                this.ctx.strokeRect(
                    start.x,
                    start.y,
                    end.x - start.x,
                    end.y - start.y
                );
                this.ctx.globalAlpha = 1;
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
            // Translate display coordinates to camera coordinates
            const start = this.translateToCameraCoords(this.startX, this.startY);
            const end = this.translateToCameraCoords(this.currentX, this.currentY);

            // Ensure coordinates are within bounds (0-639, 0-479)
            const coords = {
                x: Math.max(0, Math.min(639, start.x)),
                y: Math.max(0, Math.min(479, start.y)),
                x2: Math.max(0, Math.min(639, end.x)),
                y2: Math.max(0, Math.min(479, end.y))
            };

            // Ensure x2 > x and y2 > y
            if (coords.x2 < coords.x) {
                [coords.x, coords.x2] = [coords.x2, coords.x];
            }
            if (coords.y2 < coords.y) {
                [coords.y, coords.y2] = [coords.y2, coords.y];
            }

            // Update the window data with new coordinates
            if (!this.windows[this.currentWindow]) {
                this.windows[this.currentWindow] = {
                    coordinates: coords,
                    is_on: true
                };
            } else {
                this.windows[this.currentWindow].coordinates = coords;
            }

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
            const windowData = this.windows[index + 1];
            if (index + 1 === num) {
                btn.style.opacity = windowData?.is_on ? "1" : "0.4";
                btn.style.transform = "translateY(2px)";
                btn.style.boxShadow = "none";
                btn.style.borderColor = "rgba(0, 0, 0, 0.3)";
            } else {
                btn.style.opacity = windowData?.is_on ? "0.9" : "0.3";
                btn.style.transform = "none";
                btn.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.2)";
                btn.style.borderColor = "transparent";
            }
        });

        // Show settings panel and update values
        this.settingsPanel.style.display = "block";
        const windowData = this.windows[num] || {};
        this.enableCheckbox.checked = windowData.is_on || false;
        this.nameInput.value = windowData.name || `Window ${num}`;
        this.sensitivitySlider.value = windowData.sensitivity || 0;
        this.sensitivityLabel.textContent = `Sensitivity: ${windowData.sensitivity || 0}`;
        this.thresholdSlider.value = windowData.threshold || 0;
        this.thresholdLabel.textContent = `Threshold: ${windowData.threshold || 0}`;
    }
}

customElements.define("camera-motion-card", CameraMotionCard);

class CameraMotionCardEditor extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            config: { type: Object }
        };
    }

    static get styles() {
        return css`
            .form {
                padding: 16px;
            }
            select {
                width: 100%;
                padding: 8px;
                border-radius: 4px;
                border: 1px solid var(--divider-color, #e0e0e0);
                background: var(--card-background-color, white);
                color: var(--primary-text-color);
            }
            .label {
                display: block;
                margin-bottom: 4px;
                color: var(--primary-text-color);
            }
        `;
    }

    setConfig(config) {
        this.config = config || { entity: "" };
    }

    getCameraEntities() {
        if (!this.hass) return [];

        return Object.keys(this.hass.states)
            .filter(entityId => entityId.startsWith('camera.'))
            .map(entityId => ({
                entityId,
                name: this.hass.states[entityId].attributes.friendly_name || entityId
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    render() {
        if (!this.hass || !this.config) {
            return html``;
        }

        const cameras = this.getCameraEntities();

        return html`
            <div class="form">
                <label class="label">Camera Entity</label>
                <select
                    .value=${this.config.entity}
                    @change=${this._valueChanged}
                >
                    <option value="" disabled selected=${!this.config.entity}>Select a camera</option>
                    ${cameras.map(camera => html`
                        <option
                            value=${camera.entityId}
                            ?selected=${this.config.entity === camera.entityId}
                        >
                            ${camera.name}
                        </option>
                    `)}
                </select>
            </div>
        `;
    }

    _valueChanged(ev) {
        if (!this.config || !this.hass) return;

        const value = ev.target.value;
        if (this.config.entity === value) return;

        const newConfig = {
            ...this.config,
            entity: value
        };

        const event = new CustomEvent("config-changed", {
            detail: { config: newConfig },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }
}

customElements.define("camera-motion-card-editor", CameraMotionCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
    type: 'camera-motion-card',
    name: 'Camera Motion Card',
    preview: false,
    description: 'A card for configuring camera motion detection windows'
});
