// Settings Management
class SettingsManager {
    constructor() {
        this.settings = {
            rainThreshold: 600,
            rackInside: 30,
            rackOutside: 150
        };
        this.load();
    }
    
    load() {
        const saved = localStorage.getItem('rainguard_settings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            } catch (e) {}
        }
    }
    
    save(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('rainguard_settings', JSON.stringify(this.settings));
        
        EventBus.emit('toast', { title: 'Settings', message: 'Settings saved successfully', type: 'success' });
        EventBus.emit('settings_updated', this.settings);
        
        // Send settings to ESP32
        if (window.CommandProcessor) {
             CommandProcessor.process({
                 device: 'system',
                 action: 'SET_THRESHOLD',
                 value: this.settings.rainThreshold
             });
        }
    }
    
    get() {
        return this.settings;
    }
}

window.settingsManager = new SettingsManager();
