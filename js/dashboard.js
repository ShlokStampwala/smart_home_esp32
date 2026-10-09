// UI Updates and bindings
class DashboardUI {
    constructor() {
        this.initDOM();
        this.bindEvents();
        this.setupSubscriptions();
    }
    
    initDOM() {
        this.els = {
            // Badges
            connectionBadge: document.getElementById('connection-status-badge'),
            connectionText: document.querySelector('.status-text'),
            connectionDot: document.querySelector('.status-dot'),
            rainBadge: document.getElementById('rain-badge'),
            rackBadge: document.getElementById('rack-position-badge'),
            fanBadge: document.getElementById('fan-status-badge'),
            ledBadge: document.getElementById('led-status-badge'),
            
            // Visuals
            rainValue: document.getElementById('rain-value'),
            rainThreshold: document.getElementById('rain-threshold-display'),
            rainLevelPct: document.getElementById('rain-level-pct'),
            rainLevelFill: document.getElementById('rain-level-fill'),
            rainCard: document.getElementById('rain-status-card'),
            
            rackIcon: document.getElementById('rack-icon'),
            fanIcon: document.getElementById('fan-icon'),
            ledIcon: document.getElementById('led-icon'),
            
            // Inputs
            aiInput: document.getElementById('ai-command-input'),
            esp32Ip: document.getElementById('esp32-ip'),
            demoCheckbox: document.getElementById('demo-mode-checkbox'),
            
            themeToggleBtn: document.getElementById('btn-theme-toggle'),
            themeToggleIcon: document.getElementById('theme-toggle-icon'),
            
            // Settings
            setThreshold: document.getElementById('setting-rain-threshold'),
            setInside: document.getElementById('setting-rack-inside'),
            setOutside: document.getElementById('setting-rack-outside'),
            
            // Log
            logContainer: document.getElementById('activity-log'),
            toastContainer: document.getElementById('toast-container')
        };
        
        // Init settings UI
        const currentSettings = window.settingsManager.get();
        if (this.els.setThreshold) this.els.setThreshold.value = currentSettings.rainThreshold;
        if (this.els.setInside) this.els.setInside.value = currentSettings.rackInside;
        if (this.els.setOutside) this.els.setOutside.value = currentSettings.rackOutside;
        if (this.els.rainThreshold) this.els.rainThreshold.innerText = currentSettings.rainThreshold;
    }
    
    bindEvents() {
        // Buttons
        const bindBtn = (id, callback) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', callback);
        };
        
        bindBtn('btn-connect', () => {
            const ip = this.els.esp32Ip.value.trim();
            window.esp32.ip = ip;
            window.esp32.connect(ip || window.esp32.hostname);
        });
        
        bindBtn('btn-auto-discover', () => {
            this.els.esp32Ip.value = '';
            window.esp32.connect(window.esp32.hostname);
        });
        
        bindBtn('btn-rack-inside', () => window.CommandProcessor.process({ device: 'rack', action: 'MOVE_INSIDE' }));
        bindBtn('btn-rack-outside', () => window.CommandProcessor.process({ device: 'rack', action: 'MOVE_OUTSIDE' }));
        
        bindBtn('btn-fan-on', () => window.CommandProcessor.process({ device: 'fan', action: 'ON' }));
        bindBtn('btn-fan-off', () => window.CommandProcessor.process({ device: 'fan', action: 'OFF' }));
        
        bindBtn('btn-led-on', () => window.CommandProcessor.process({ device: 'led', action: 'ON' }));
        bindBtn('btn-led-off', () => window.CommandProcessor.process({ device: 'led', action: 'OFF' }));
        
        bindBtn('btn-send-ai', () => {
            if (window.ai) window.ai.processText(this.els.aiInput.value);
            this.els.aiInput.value = '';
        });
        
        bindBtn('btn-voice', () => {
            if (window.voice) window.voice.toggle();
        });
        
        bindBtn('btn-clear-log', () => {
            if (this.els.logContainer) this.els.logContainer.innerHTML = '';
        });
        
        bindBtn('btn-save-settings', () => {
            window.settingsManager.save({
                rainThreshold: parseInt(this.els.setThreshold.value) || 600,
                rackInside: parseInt(this.els.setInside.value) || 30,
                rackOutside: parseInt(this.els.setOutside.value) || 150
            });
        });
        
        // AI Input Enter key
        if (this.els.aiInput) {
            this.els.aiInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (window.ai) window.ai.processText(this.els.aiInput.value);
                    this.els.aiInput.value = '';
                }
            });
        }

        // Demo simulate rain click on sensor card
        if (this.els.rainCard) {
             this.els.rainCard.addEventListener('dblclick', () => {
                 if (window.esp32 && window.esp32.isDemoMode) {
                     window.esp32.simulateRain();
                 }
             });
        }
    }
    
    setupSubscriptions() {
        EventBus.on('esp32_connection_change', (connected) => {
            if (connected) {
                this.els.connectionDot.className = 'status-dot connected';
                this.els.connectionText.innerText = 'CONNECTED';
            } else {
                this.els.connectionDot.className = 'status-dot offline';
                this.els.connectionText.innerText = 'OFFLINE';
            }
        });
        
        EventBus.on('esp32_state', (state) => this.updateState(state));
        
        EventBus.on('log', (log) => this.addLog(log));
        
        EventBus.on('toast', (toast) => this.showToast(toast));
        
        EventBus.on('settings_updated', (settings) => {
            this.els.rainThreshold.innerText = settings.rainThreshold;
        });
    }
    
    updateState(state) {
        // Update Rain
        if (this.els.rainValue) this.els.rainValue.innerText = state.rainValue;
        if (this.els.rainThreshold) this.els.rainThreshold.innerText = state.rainThreshold;
        
        if (state.rainDetected) {
            this.els.rainBadge.innerText = 'RAIN DETECTED';
            this.els.rainBadge.className = 'badge danger';
            this.els.rainCard.classList.add('rain-detected');
        } else {
            this.els.rainBadge.innerText = 'DRY';
            this.els.rainBadge.className = 'badge success';
            this.els.rainCard.classList.remove('rain-detected');
        }
        
        // Calculate percentage (assuming 0-1023 analog range, adjust as needed)
        // Assuming lower value = more rain for this formula
        let pct = 0;
        if (state.rainValue > 0) {
            // Rough calculation based on threshold
            if (state.rainDetected) {
                pct = 100 - (state.rainValue / state.rainThreshold * 50); // 50-100%
            } else {
                pct = ((1023 - state.rainValue) / (1023 - state.rainThreshold) * 50); // 0-50%
            }
        }
        pct = Math.max(0, Math.min(100, pct));
        
        if (this.els.rainLevelPct) this.els.rainLevelPct.innerText = `${Math.round(pct)}%`;
        if (this.els.rainLevelFill) this.els.rainLevelFill.style.width = `${pct}%`;
        
        // Update Rack
        if (this.els.rackBadge) {
            this.els.rackBadge.innerText = state.rackPosition;
            if (state.rackPosition === 'INSIDE') this.els.rackBadge.className = 'badge active';
            else if (state.rackPosition === 'OUTSIDE') this.els.rackBadge.className = 'badge';
            else this.els.rackBadge.className = 'badge danger';
        }
        
        if (this.els.rackIcon) {
            this.els.rackIcon.className = 'rack-icon'; // reset
            if (state.rackPosition === 'MOVING_INSIDE') this.els.rackIcon.classList.add('rack-moving-in');
            else if (state.rackPosition === 'MOVING_OUTSIDE') this.els.rackIcon.classList.add('rack-moving-out');
        }
        
        // Update Fan
        if (this.els.fanBadge) {
            this.els.fanBadge.innerText = state.fan ? 'ON' : 'OFF';
            this.els.fanBadge.className = state.fan ? 'badge active' : 'badge';
        }
        if (this.els.fanIcon) {
            this.els.fanIcon.className = state.fan ? 'fan-icon on' : 'fan-icon';
        }
        
        // Update LED
        if (this.els.ledBadge) {
            this.els.ledBadge.innerText = state.led ? 'ON' : 'OFF';
            this.els.ledBadge.className = state.led ? 'badge active' : 'badge';
        }
        if (this.els.ledIcon) {
            this.els.ledIcon.className = state.led ? 'led-icon on' : 'led-icon';
        }
    }
    
    addLog(log) {
        if (!this.els.logContainer) return;
        
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        
        const time = new Date(log.time).toLocaleTimeString();
        
        let icon = 'ℹ️';
        if (log.type === 'error') icon = '❌';
        else if (log.type === 'success') icon = '✅';
        else if (log.type === 'warning') icon = '⚠️';
        
        entry.innerHTML = `
            <span class="log-time">${time}</span>
            <div>${icon} <strong>${log.title}:</strong> ${log.message}</div>
        `;
        
        this.els.logContainer.prepend(entry);
        
        // Keep only last 50 entries
        while (this.els.logContainer.children.length > 50) {
            this.els.logContainer.removeChild(this.els.logContainer.lastChild);
        }
    }
    
    showToast({ title, message, type = 'info' }) {
        if (!this.els.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        toast.innerHTML = `
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        `;
        
        this.els.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => {
                if (toast.parentNode === this.els.toastContainer) {
                    this.els.toastContainer.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

window.dashboardUI = new DashboardUI();
