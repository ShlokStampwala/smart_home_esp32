# RAIN GUARD AI

An AI-Powered Smart Rain Protection System with IoT Capabilities for college demonstration.

## Overview
This system uses an ESP32 to detect rain via an analog sensor and automatically bring a clothes rack inside using a servo motor. It features an independent fan and LED, controlled via a mobile-first web dashboard that connects to the ESP32 over a local network WebSocket connection. The dashboard integrates AI-powered voice and text command recognition using the Groq API.

## Features
- **Automatic Rain Protection:** The ESP32 autonomously moves the rack inside when rain is detected and outside when dry.
- **Independent Device Control:** Fan and LED are controlled manually, independently from the rain logic.
- **AI Voice & Text Commands:** Speak or type commands like "Turn on the fan" or "Rack andar karo" to control the system.
- **Real-Time Synchronization:** All connected devices instantly reflect the current hardware state via WebSockets.
- **Demo Mode:** Test the UI without an actual ESP32 connected.

## Architecture
- **Hardware:** ESP32, Analog Rain Sensor, Servo Motor, Relay Module, DC Motor (Fan), LED.
- **Frontend:** Vanilla HTML/CSS/JS (no heavy frameworks).
- **Backend/AI:** Netlify Functions + Groq API.
- **Communication:** Local WebSocket connection (`ws://rainguard.local/ws`) for real-time, low-latency control.

## Setup Instructions

### 1. ESP32 Setup
1. Open `esp32/rain_guard_esp32.ino` in the Arduino IDE.
2. Install required libraries: `WiFi`, `AsyncTCP`, `ESPAsyncWebServer`, `ESPmDNS`, `ArduinoJson`, `ESP32Servo`.
3. Update your WiFi hotspot credentials in the code if needed.
4. Upload the code to your ESP32.

### 2. Website Setup (Local Development)
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file based on `.env.example` and add your Groq API key:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```
3. Run the development server (requires Netlify CLI):
   ```bash
   npm run start
   ```

### 3. Demonstration Scenario
1. Turn on the WiFi hotspot from Phone 1.
2. Connect the ESP32 and Phone 2 to Phone 1's hotspot.
3. Open the hosted dashboard on Phone 2 (or enter the local IP).
4. The dashboard will connect to the ESP32.
5. Apply water to the rain sensor -> The rack moves inside automatically. The fan state does not change.
6. Press the microphone and say "Fan chalu karo" -> The AI parses the intent, and the fan turns ON independently.

## Security Considerations
- The Groq API key is secured in a serverless function (`netlify/functions/ai.js`) and never exposed to the frontend.
- AI commands are parsed into structured JSON and validated before being sent to the ESP32.
- The ESP32 is the single source of truth for the hardware state.

## Important Note on Connectivity
Modern browsers block mixed-content requests (HTTP from HTTPS). For the best experience, ensure your Netlify site uses secure WebSockets or serve the page directly from the ESP32 on the local network if HTTP is strictly required. A common workaround for local testing is to access the site via HTTP or use Chrome's insecure origins flag.
