// AI Integration using serverless function
class AIManager {
    constructor() {
        this.endpoint = '/.netlify/functions/ai'; // Netlify function path
    }
    
    async processText(text) {
        if (!text.trim()) return;
        
        logEvent('AI Command', text);
        EventBus.emit('ai_processing_start');
        const localApiKey = localStorage.getItem('groq_api_key') || '';

        // 1. Direct Groq Cloud API Call (Using recommended replacement models)
        if (localApiKey) {
            const replacementModels = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];
            
            for (const modelName of replacementModels) {
                try {
                    console.log(`Sending API request to AI Assistant (${modelName})...`);
                    logEvent('🤖 AI Assistant', `Processing AI command...`);

                    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${localApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: modelName,
                            temperature: 0.1,
                            messages: [
                                {
                                    role: 'system',
                                    content: `You are an AI assistant for a Smart Home System.
Available devices and actions:
1. 'fan': 'ON', 'OFF'
2. 'rack': 'MOVE_INSIDE', 'MOVE_OUTSIDE'
3. 'led': 'ON', 'OFF'

Understand user intent in English, Hindi, or Gujarati.
Output ONLY a valid JSON object:
{
  "commands": [{"device": "fan", "action": "ON"}],
  "response": "Turning on fan"
}`
                                },
                                { role: 'user', content: text }
                            ],
                            response_format: { type: 'json_object' }
                        })
                    });

                    if (groqRes.ok) {
                        const groqData = await groqRes.json();
                        const aiContent = JSON.parse(groqData.choices[0].message.content);
                        console.log('AI Response:', aiContent);
                        logEvent('🤖 AI Assistant', `AI Response: "${aiContent.response || 'Command executed'}"`, 'success');
                        this.handleAiResponse(aiContent);
                        return; // Success!
                    }
                } catch (err) {
                    console.warn(`AI fetch failed for ${modelName}`, err);
                }
            }
        }

        // 2. Try Netlify Serverless Function Endpoint
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: text })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.handleAiResponse(data);
                return;
            }
        } catch (e) {}

        // 3. Fallback Local Parser
        this.fallbackProcess(text);
    }

    handleAiResponse(data) {
        EventBus.emit('toast', {
            title: '🤖 AI Assistant',
            message: data.response || 'Command processed',
            type: 'success'
        });
        
        if (data.commands && Array.isArray(data.commands)) {
            CommandProcessor.processMultiple(data.commands);
        } else if (data.device && data.action) {
            CommandProcessor.process(data);
        }
    }
    
    
    // Smart local fallback matching for Hinglish, English, and Gujarati variations
    fallbackProcess(text) {
        const lower = text.toLowerCase().trim();
        let cmds = [];
        let responses = [];

        // --- FAN CONTROL ---
        const isFanMentioned = lower.includes('fan') || lower.includes('pankha') || lower.includes('pankho') || lower.includes('પંખો');
        if (isFanMentioned) {
            if (lower.includes('on') || lower.includes('chalu') || lower.includes('ચાલુ') || lower.includes('start') || lower.includes('shuru') || lower.includes('chalao') || lower.includes('kar do')) {
                if (!lower.includes('off') && !lower.includes('band') && !lower.includes('બંધ')) {
                    cmds.push({ device: 'fan', action: 'ON' });
                    responses.push('Fan turned ON');
                }
            }
            if (lower.includes('off') || lower.includes('band') || lower.includes('bandh') || lower.includes('બંધ') || lower.includes('stop') || lower.includes('rok')) {
                cmds.push({ device: 'fan', action: 'OFF' });
                responses.push('Fan turned OFF');
            }
        } else if (lower.startsWith('turn on fan') || lower === 'fan on') {
            cmds.push({ device: 'fan', action: 'ON' });
            responses.push('Fan turned ON');
        } else if (lower.startsWith('turn off fan') || lower === 'fan off') {
            cmds.push({ device: 'fan', action: 'OFF' });
            responses.push('Fan turned OFF');
        }

        // --- RACK CONTROL ---
        const isRackMentioned = lower.includes('rack') || lower.includes('kapde') || lower.includes('kapda') || lower.includes('clothes') || lower.includes('કાપડ');
        if (isRackMentioned || lower.includes('andar') || lower.includes('bahar') || lower.includes('અંદર') || lower.includes('બહાર')) {
            if (lower.includes('andar') || lower.includes('અંદર') || lower.includes('in') || lower.includes('inside') || lower.includes('le lo') || lower.includes('lao')) {
                if (!lower.includes('bahar') && !lower.includes('બહાર') && !lower.includes('out')) {
                    cmds.push({ device: 'rack', action: 'MOVE_INSIDE' });
                    responses.push('Rack moving INSIDE');
                }
            }
            if (lower.includes('bahar') || lower.includes('બહાર') || lower.includes('out') || lower.includes('outside') || lower.includes('nikalo') || lower.includes('muko')) {
                cmds.push({ device: 'rack', action: 'MOVE_OUTSIDE' });
                responses.push('Rack moving OUTSIDE');
            }
        }

        // --- LED CONTROL ---
        const isLedMentioned = lower.includes('led') || lower.includes('light') || lower.includes('batti') || lower.includes('lamp') || lower.includes('લાઈટ');
        if (isLedMentioned) {
            if (lower.includes('on') || lower.includes('chalu') || lower.includes('ચાલુ') || lower.includes('start') || lower.includes('jalao') || lower.includes('kar do')) {
                if (!lower.includes('off') && !lower.includes('band') && !lower.includes('બંધ')) {
                    cmds.push({ device: 'led', action: 'ON' });
                    responses.push('LED turned ON');
                }
            }
            if (lower.includes('off') || lower.includes('band') || lower.includes('bandh') || lower.includes('બંધ') || lower.includes('bujhao')) {
                cmds.push({ device: 'led', action: 'OFF' });
                responses.push('LED turned OFF');
            }
        }

        // --- RAIN / STATUS ---
        if (lower.includes('status') || lower.includes('barish') || lower.includes('baarish') || lower.includes('rain')) {
            responses.push('Current rain status displayed on dashboard.');
        }

        if (cmds.length > 0) {
            EventBus.emit('toast', {
                title: '🤖 Local AI Parser',
                message: responses.join(' & ') || 'Command Executed',
                type: 'success'
            });
            CommandProcessor.processMultiple(cmds);
        } else {
            EventBus.emit('toast', {
                title: '🤖 AI Assistant',
                message: `Could not recognize device in: "${text}". Try e.g. "Fan chalu karo", "Kapde andar karo", or "LED on".`,
                type: 'warning'
            });
        }
    }
}

window.ai = new AIManager();

