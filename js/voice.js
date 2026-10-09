class VoiceManager {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.statusElement = document.getElementById('voice-status');
        
        this.init();
    }
    
    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported in this browser.');
            return;
        }
        
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        
        // Listen to language select changes
        const langSelect = document.getElementById('voice-lang-select');
        this.recognition.lang = langSelect ? langSelect.value : 'hi-IN';
        if (langSelect) {
            langSelect.addEventListener('change', (e) => {
                if (this.recognition) {
                    this.recognition.lang = e.target.value;
                    logEvent('Voice Lang', `Voice language set to ${e.target.options[e.target.selectedIndex].text}`, 'info');
                }
            });
        }
        
        this.recognition.onstart = () => {
            this.isListening = true;
            if (this.statusElement) this.statusElement.classList.remove('hidden');
        };
        
        this.recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            const input = document.getElementById('ai-command-input');
            if (input) input.value = text;
            
            // Auto send
            if (window.ai) {
                window.ai.processText(text);
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            EventBus.emit('toast', { title: 'Voice Error', message: event.error, type: 'error' });
            this.stop();
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            if (this.statusElement) this.statusElement.classList.add('hidden');
        };
    }
    
    toggle() {
        if (!this.recognition) {
            EventBus.emit('toast', { title: 'Not Supported', message: 'Speech recognition is not supported in this browser.', type: 'error' });
            return;
        }
        
        if (this.isListening) {
            this.stop();
        } else {
            this.start();
        }
    }
    
    start() {
        try {
            this.recognition.start();
        } catch (e) {
            console.error('Failed to start recognition', e);
        }
    }
    
    stop() {
        try {
            this.recognition.stop();
        } catch (e) {}
    }
}

window.voice = new VoiceManager();
