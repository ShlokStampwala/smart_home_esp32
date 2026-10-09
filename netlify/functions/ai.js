const { Groq } = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const userCommand = body.command;

    if (!userCommand) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No command provided' }) };
    }

    const systemPrompt = `You are an AI assistant for a Smart Rain Protection IoT System.
The system has these devices:
1. 'fan' - Can be turned 'ON' or 'OFF'
2. 'rack' (Clothes Rack) - Can be 'MOVE_INSIDE' or 'MOVE_OUTSIDE'
3. 'led' - Can be 'ON' or 'OFF'
4. 'rain' - Can get 'STATUS'

User will give a command in English, Hindi, or Gujarati.
Your job is to extract the intended hardware action and output ONLY a JSON object.

Allowed devices: fan, rack, led, rain, system
Allowed actions: ON, OFF, MOVE_INSIDE, MOVE_OUTSIDE, STATUS

Return format:
{
  "commands": [
    {
      "device": "string",
      "action": "string"
    }
  ],
  "response": "Short friendly acknowledgement in English"
}

Do not add markdown formatting to the JSON response. Do not output anything other than JSON.
If the user says something irrelevant, return response explaining what you can do, and empty commands array.

Examples:
User: "Turn on the fan"
Output: {"commands": [{"device": "fan", "action": "ON"}], "response": "Fan turned on."}

User: "Rack andar kar do"
Output: {"commands": [{"device": "rack", "action": "MOVE_INSIDE"}], "response": "Rack moving inside."}

User: "Fan on karo aur LED off kar do"
Output: {"commands": [{"device": "fan", "action": "ON"}, {"device": "led", "action": "OFF"}], "response": "Turning on the fan and turning off the LED."}
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userCommand }
      ],
      model: 'openai/gpt-oss-20b',
      temperature: 0.1,
      max_tokens: 256,
      response_format: { type: "json_object" }
    });

    const aiResponseText = chatCompletion.choices[0]?.message?.content || '{}';
    let aiResponse;
    try {
      aiResponse = JSON.parse(aiResponseText);
    } catch (e) {
      console.error('Failed to parse Groq response:', aiResponseText);
      aiResponse = { error: 'Failed to parse AI response' };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Adjust in production
      },
      body: JSON.stringify(aiResponse),
    };

  } catch (error) {
    console.error('Groq API Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
