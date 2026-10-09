// ESP32 Real-Time Hardware Communication Manager
class ESP32Connection {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.hostname = 'smart-home.local';
        this.ip = '';
        this.reconnectTimer = null;
        this.pollTimer = null;
        this.isDemoMode = false;
        this.useHttpFallback = false;
        
        // State copy
        this.state = {
            rainValue: 0,
            rainThreshold: 600,
            rainDetected: false,
            rackPosition: 'UNKNOWN', // OUTSIDE, INSIDE, MOVING_INSIDE, MOVING_OUTSIDE
            fan: false,
            led: false
        };
        
        EventBus.on('send_to_esp32', (data) => this.send(data));
        EventBus.on('demo_mode_changed', (enabled) => {
            this.isDemoMode = enabled;
            if (enabled) {
                this.disconnect();
                this.setConnected(true);
                EventBus.emit('esp32_state', this.state);
            } else {
                this.setConnected(false);
            }
        });
    }

    getTargetAddress() {
        return this.ip || this.hostname;
    }
    
    connect(address = null) {
        if (this.isDemoMode) return;
        
        if (address) this.ip = address;
        const target = this.getTargetAddress();
        if (!target) return;
        
        this.setConnected(false);
        logEvent('Connection', `Connecting to ${target}...`);
        
        // Check if we are running on HTTPS page trying to talk to unsecure HTTP/WS
        const isHttpsPage = window.location.protocol === 'https:';
        if (isHttpsPage) {
            logEvent('Security Warning', 'Hosted on HTTPS. Standard browser security may block local WS/HTTP requests.', 'warning');
        }

        try {
            if (this.ws) {
                this.ws.close();
            }
            
            this.ws = new WebSocket(`ws://${target}/ws`);
            
            this.ws.onopen = () => {
                this.useHttpFallback = false;
                this.setConnected(true);
                logEvent('Connection', `Connected to ESP32 via WebSocket (${target})`, 'success');
                if (this.reconnectTimer) {
                    clearInterval(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
                if (this.pollTimer) {
                    clearInterval(this.pollTimer);
                    this.pollTimer = null;
                }
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.error('Failed to parse ESP32 message', e);
                }
            };
            
            this.ws.onclose = () => {
                if (!this.connected && !this.useHttpFallback) {
                    // Try HTTP REST Fallback
                    this.startHttpPolling();
                } else {
                    this.setConnected(false);
                    this.scheduleReconnect();
                }
            };
            
            this.ws.onerror = (err) => {
                // Silently fallback if hardware is offline / unreachable
                this.startHttpPolling();
            };
        } catch (e) {
            this.startHttpPolling();
        }
    }

    // HTTP REST Polling Fallback if WebSocket is blocked by HTTPS Mixed-Content or Firewall
    startHttpPolling() {
        if (this.useHttpFallback || this.isDemoMode) return;
        
        this.useHttpFallback = true;
        logEvent('Connection', 'Switched to HTTP REST API fallback polling', 'info');

        if (this.pollTimer) clearInterval(this.pollTimer);
        
        const fetchStatus = async () => {
            const target = this.getTargetAddress();
            try {
                const response = await fetch(`http://${target}/api/status`, { mode: 'cors' });
                if (response.ok) {
                    const data = await response.json();
                    if (!this.connected) {
                        this.setConnected(true);
                        logEvent('Connection', 'Connected to ESP32 via HTTP REST API', 'success');
                    }
                    this.handleMessage(data);
                } else {
                    this.setConnected(false);
                }
            } catch (e) {
                this.setConnected(false);
            }
        };

        fetchStatus();
        this.pollTimer = setInterval(fetchStatus, 1500);
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectTimer) {
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.setConnected(false);
    }
    
    scheduleReconnect() {
        if (!this.reconnectTimer && !this.isDemoMode) {
            this.reconnectTimer = setInterval(() => {
                this.connect();
            }, 4000);
        }
    }
    
    setConnected(status) {
        this.connected = status;
        EventBus.emit('esp32_connection_change', status);
    }
    
    handleMessage(data) {
        if (data.rainSensor !== undefined && data.rainValue === undefined) {
            data.rainValue = data.rainSensor;
        }
        if (data.type === 'status' || data.rainValue !== undefined || data.rainSensor !== undefined) {
            Object.assign(this.state, data);
            EventBus.emit('esp32_state', this.state);
        } else if (data.type === 'event') {
            logEvent('ESP32 Event', data.message);
        }
    }
    
    async send(data) {
        if (this.isDemoMode) {
            this.simulateCommand(data);
            return;
        }

        const target = this.getTargetAddress();

        // 1. Try WebSocket if active
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(data));
                return;
            } catch (e) {
                console.error('WS send error, attempting HTTP REST POST fallback...', e);
            }
        }

        // 2. HTTP REST POST Fallback
        try {
            const response = await fetch(`http://${target}/api/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                const updatedState = await response.json();
                this.handleMessage(updatedState);
            } else {
                EventBus.emit('toast', { title: 'ESP32 Error', message: 'Command rejected by hardware', type: 'error' });
            }
        } catch (e) {
            EventBus.emit('toast', { title: 'Connection Error', message: `ESP32 unreachable at ${target}`, type: 'error' });
            this.connect();
        }
    }
    
    simulateCommand(cmd) {
        if (cmd.type !== 'command') return;
        
        setTimeout(() => {
            logEvent('Command', `Executed ${cmd.action} on ${cmd.device.toUpperCase()}`, 'info');

            if (cmd.device === 'fan') {
                this.state.fan = (cmd.action === 'ON');
            } else if (cmd.device === 'led') {
                this.state.led = (cmd.action === 'ON');
            } else if (cmd.device === 'rack') {
                if (cmd.action === 'MOVE_INSIDE') {
                    if (this.state.rackPosition === 'INSIDE' || this.state.rackPosition === 'MOVING_INSIDE') {
                        logEvent('Clothes Rack', 'Rack is already INSIDE', 'warning');
                        return;
                    }
                    this.state.rackPosition = 'MOVING_INSIDE';
                    EventBus.emit('esp32_state', this.state);
                    setTimeout(() => {
                        this.state.rackPosition = 'INSIDE';
                        EventBus.emit('esp32_state', this.state);
                        logEvent('Clothes Rack', 'Rack arrived INSIDE', 'success');
                    }, 2000);
                    return;
                } else if (cmd.action === 'MOVE_OUTSIDE') {
                    if (this.state.rackPosition === 'OUTSIDE' || this.state.rackPosition === 'MOVING_OUTSIDE') {
                        logEvent('Clothes Rack', 'Rack is already OUTSIDE', 'warning');
                        return;
                    }
                    this.state.rackPosition = 'MOVING_OUTSIDE';
                    EventBus.emit('esp32_state', this.state);
                    setTimeout(() => {
                        this.state.rackPosition = 'OUTSIDE';
                        EventBus.emit('esp32_state', this.state);
                        logEvent('Clothes Rack', 'Rack arrived OUTSIDE', 'success');
                    }, 2000);
                    return;
                }
            } else if (cmd.device === 'system' && cmd.action === 'SET_THRESHOLD') {
                 this.state.rainThreshold = cmd.value;
            }
            EventBus.emit('esp32_state', this.state);
        }, 200);
    }
    
    simulateRain() {
        if (!this.isDemoMode) return;
        this.state.rainValue = this.state.rainValue > 500 ? 200 : 800; // Toggle
        this.state.rainDetected = this.state.rainValue < this.state.rainThreshold;
        
        if (this.state.rainDetected && this.state.rackPosition !== 'INSIDE') {
            this.state.rackPosition = 'MOVING_INSIDE';
            setTimeout(() => {
                this.state.rackPosition = 'INSIDE';
                EventBus.emit('esp32_state', this.state);
            }, 2000);
        } else if (!this.state.rainDetected && this.state.rackPosition !== 'OUTSIDE') {
            this.state.rackPosition = 'MOVING_OUTSIDE';
            setTimeout(() => {
                this.state.rackPosition = 'OUTSIDE';
                EventBus.emit('esp32_state', this.state);
            }, 2000);
        }
        EventBus.emit('esp32_state', this.state);
    }
}

window.esp32 = new ESP32Connection();
