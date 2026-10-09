// Simple Event Bus for decoupled communication
const EventBus = {
    listeners: {},
    
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    },
    
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
};

// Global config
const AppConfig = {
    logToConsole: true
};

function logEvent(title, message, type = 'info') {
    EventBus.emit('log', { title, message, type, time: new Date() });
}

// Ensure EventBus is globally available
window.EventBus = EventBus;
window.logEvent = logEvent;
