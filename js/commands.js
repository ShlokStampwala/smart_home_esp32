// Command validation and handling
const ALLOWED_DEVICES = ['fan', 'rack', 'led', 'system', 'rain'];
const ALLOWED_ACTIONS = ['ON', 'OFF', 'MOVE_INSIDE', 'MOVE_OUTSIDE', 'STATUS', 'SET_THRESHOLD'];

class CommandProcessor {
    static validate(command) {
        if (!command || typeof command !== 'object') {
            return { valid: false, error: 'Invalid command format' };
        }
        
        if (!ALLOWED_DEVICES.includes(command.device)) {
            return { valid: false, error: `Device not allowed: ${command.device}` };
        }
        
        if (!ALLOWED_ACTIONS.includes(command.action)) {
            return { valid: false, error: `Action not allowed: ${command.action}` };
        }
        
        return { valid: true };
    }
    
    static process(command) {
        const validation = this.validate(command);
        if (!validation.valid) {
            console.error(validation.error);
            EventBus.emit('command_error', validation.error);
            return false;
        }

        // Prevent redundant servo movements
        if (command.device === 'rack' && window.esp32 && window.esp32.state) {
            const currentPos = window.esp32.state.rackPosition;
            if (command.action === 'MOVE_INSIDE' && (currentPos === 'INSIDE' || currentPos === 'MOVING_INSIDE')) {
                EventBus.emit('toast', { title: '👕 Clothes Rack', message: 'Rack is already INSIDE', type: 'info' });
                return false;
            }
            if (command.action === 'MOVE_OUTSIDE' && (currentPos === 'OUTSIDE' || currentPos === 'MOVING_OUTSIDE')) {
                EventBus.emit('toast', { title: '👕 Clothes Rack', message: 'Rack is already OUTSIDE', type: 'info' });
                return false;
            }
        }
        
        EventBus.emit('command_validated', command);
        
        // Route to ESP32
        EventBus.emit('send_to_esp32', {
            type: 'command',
            device: command.device,
            action: command.action,
            value: command.value || null,
            requestId: Date.now().toString(36)
        });
        
        return true;
    }
    
    static processMultiple(commands) {
        if (!Array.isArray(commands)) {
            return this.process(commands);
        }
        
        let allValid = true;
        for (const cmd of commands) {
            if (!this.process(cmd)) {
                allValid = false;
            }
        }
        return allValid;
    }
}

window.CommandProcessor = CommandProcessor;
