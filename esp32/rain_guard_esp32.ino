#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ESPmDNS.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// =====================================================
//                    PIN DEFINITIONS
// =====================================================

#define RAIN_SENSOR_PIN 34
#define SERVO_PIN       13
#define FAN_RELAY_PIN   14
#define LED_PIN         12

// =====================================================
//                    WIFI SETTINGS
// =====================================================

const char* WIFI_SSID = "YOUR_HOTSPOT_NAME";
const char* WIFI_PASSWORD = "YOUR_HOTSPOT_PASSWORD";

const char* HOSTNAME = "smart-home";

// =====================================================
//                    RAIN SETTINGS
// =====================================================

// Most rain sensor modules give LOWER value when wet.
// If yours behaves opposite, change this to false.
const bool RAIN_LOW_VALUE_MEANS_RAIN = true;

int rainThreshold = 600;

// =====================================================
//                    SERVO SETTINGS
// =====================================================

const int SERVO_INSIDE_ANGLE = 70;
const int SERVO_OUTSIDE_ANGLE = 180;

// Servo movement time
const unsigned long SERVO_MOVE_TIME = 1200;

// =====================================================
//                    OBJECTS
// =====================================================

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
Servo rackServo;

// =====================================================
//                    SYSTEM STATES
// =====================================================

bool isRainDetected = false;

String rackPosition = "OUTSIDE";
String targetRackPosition = "OUTSIDE";

bool fanState = false;
bool ledState = false;

bool rackMoving = false;
unsigned long rackMoveStartTime = 0;

// =====================================================
//                    FUNCTION DECLARATIONS
// =====================================================

void broadcastState();
void startRackMovement(String target);
void updateRackMovement();
void setFan(bool state);
void setLed(bool state);
void checkRainSensor();
void handleCommand(String command, JsonDocument& doc);

// =====================================================
//                    GET SYSTEM STATUS JSON
// =====================================================

String getStatusJSON() {

  JsonDocument doc;

  doc["type"] = "status";
  doc["rainDetected"] = isRainDetected;
  doc["rainSensor"] = analogRead(RAIN_SENSOR_PIN);
  doc["rainValue"] = analogRead(RAIN_SENSOR_PIN);
  doc["rainThreshold"] = rainThreshold;

  doc["rackPosition"] = rackPosition;
  doc["targetRackPosition"] = targetRackPosition;
  doc["rackMoving"] = rackMoving;

  doc["fan"] = fanState;
  doc["led"] = ledState;

  doc["wifiConnected"] = WiFi.status() == WL_CONNECTED;
  doc["ip"] = WiFi.localIP().toString();
  doc["hostname"] = HOSTNAME;

  String output;
  serializeJson(doc, output);

  return output;
}

// =====================================================
//                    BROADCAST STATE
// =====================================================

void broadcastState() {

  String json = getStatusJSON();

  ws.textAll(json);
}

// =====================================================
//                    SERVO MOVEMENT
// =====================================================

void startRackMovement(String target) {

  if (target != "INSIDE" && target != "OUTSIDE") {
    return;
  }

  // Prevent redundant movements if already in target position
  if (target == rackPosition && !rackMoving) {
    return;
  }

  int targetAngle;

  if (target == "INSIDE") {
    targetAngle = SERVO_INSIDE_ANGLE;
  } else {
    targetAngle = SERVO_OUTSIDE_ANGLE;
  }

  targetRackPosition = target;
  rackPosition = target == "INSIDE"
                   ? "MOVING_INSIDE"
                   : "MOVING_OUTSIDE";

  rackServo.write(targetAngle);

  rackMoving = true;
  rackMoveStartTime = millis();

  broadcastState();

  Serial.print("Rack moving to: ");
  Serial.println(target);
}

// =====================================================
//                    UPDATE SERVO
// =====================================================

void updateRackMovement() {

  if (!rackMoving) {
    return;
  }

  if (millis() - rackMoveStartTime >= SERVO_MOVE_TIME) {

    rackMoving = false;
    rackPosition = targetRackPosition;

    broadcastState();

    Serial.print("Rack reached: ");
    Serial.println(rackPosition);
  }
}

// =====================================================
//                    FAN CONTROL
// =====================================================

void setFan(bool state) {

  fanState = state;

  digitalWrite(
    FAN_RELAY_PIN,
    state ? HIGH : LOW
  );

  Serial.print("Fan: ");
  Serial.println(state ? "ON" : "OFF");

  broadcastState();
}

// =====================================================
//                    LED CONTROL
// =====================================================

void setLed(bool state) {

  ledState = state;

  digitalWrite(
    LED_PIN,
    state ? HIGH : LOW
  );

  Serial.print("LED: ");
  Serial.println(state ? "ON" : "OFF");

  broadcastState();
}

// =====================================================
//                    RAIN SENSOR
// =====================================================

void checkRainSensor() {

  static unsigned long lastRainCheck = 0;

  if (millis() - lastRainCheck < 1000) {
    return;
  }

  lastRainCheck = millis();

  int value = analogRead(RAIN_SENSOR_PIN);

  bool rainNow;

  if (RAIN_LOW_VALUE_MEANS_RAIN) {
    rainNow = value < rainThreshold;
  } else {
    rainNow = value > rainThreshold;
  }

  // Only act when rain state changes
  if (rainNow != isRainDetected) {

    isRainDetected = rainNow;

    Serial.print("Rain sensor value: ");
    Serial.println(value);

    if (isRainDetected) {

      Serial.println("RAIN DETECTED");
      Serial.println("Moving rack INSIDE");

      startRackMovement("INSIDE");

    } else {

      Serial.println("RAIN STOPPED");
      Serial.println("Moving rack OUTSIDE");

      startRackMovement("OUTSIDE");
    }

    broadcastState();
  }
}

// =====================================================
//                    COMMAND HANDLER
// =====================================================

void handleCommand(String command, JsonDocument& doc) {

  String device = doc["device"] | "";
  String action = doc["action"] | "";

  Serial.print("Command received - Device: ");
  Serial.print(device);
  Serial.print(" | Action: ");
  Serial.println(action);

  // ---------------------------------------------------
  // RACK
  // ---------------------------------------------------

  if (action == "MOVE_INSIDE" || (device == "rack" && action == "MOVE_INSIDE")) {
    startRackMovement("INSIDE");
    return;
  }

  if (action == "MOVE_OUTSIDE" || (device == "rack" && action == "MOVE_OUTSIDE")) {
    startRackMovement("OUTSIDE");
    return;
  }

  if (action == "RACK_STATUS") {
    broadcastState();
    return;
  }

  // ---------------------------------------------------
  // FAN
  // ---------------------------------------------------

  if (action == "FAN_ON" || (device == "fan" && (action == "ON" || action == "FAN_ON"))) {
    setFan(true);
    return;
  }

  if (action == "FAN_OFF" || (device == "fan" && (action == "OFF" || action == "FAN_OFF"))) {
    setFan(false);
    return;
  }

  if (action == "FAN_STATUS") {
    broadcastState();
    return;
  }

  // ---------------------------------------------------
  // LED
  // ---------------------------------------------------

  if (action == "LED_ON" || (device == "led" && (action == "ON" || action == "LED_ON"))) {
    setLed(true);
    return;
  }

  if (action == "LED_OFF" || (device == "led" && (action == "OFF" || action == "LED_OFF"))) {
    setLed(false);
    return;
  }

  if (action == "LED_STATUS") {
    broadcastState();
    return;
  }

  // ---------------------------------------------------
  // RAIN STATUS
  // ---------------------------------------------------

  if (action == "RAIN_STATUS") {
    broadcastState();
    return;
  }

  // ---------------------------------------------------
  // COMPLETE SYSTEM STATUS
  // ---------------------------------------------------

  if (action == "SYSTEM_STATUS") {
    broadcastState();
    return;
  }

  // ---------------------------------------------------
  // RAIN THRESHOLD
  // ---------------------------------------------------

  if (action == "SET_THRESHOLD" || (device == "system" && action == "SET_THRESHOLD")) {
    if (doc["value"].is<int>()) {
      rainThreshold = doc["value"].as<int>();
      Serial.print("New rain threshold: ");
      Serial.println(rainThreshold);
      broadcastState();
    }
    return;
  }

  Serial.println("Unknown command");
}

// =====================================================
//                    WEBSOCKET EVENTS
// =====================================================

void onWebSocketEvent(
  AsyncWebSocket *server,
  AsyncWebSocketClient *client,
  AwsEventType type,
  void *arg,
  uint8_t *data,
  size_t len
) {

  if (type == WS_EVT_CONNECT) {

    Serial.print("WebSocket client connected: ");
    Serial.println(client->id());

    client->text(getStatusJSON());

    return;
  }

  if (type == WS_EVT_DISCONNECT) {

    Serial.print("WebSocket client disconnected: ");
    Serial.println(client->id());

    return;
  }

  if (type == WS_EVT_DATA) {

    AwsFrameInfo *info = (AwsFrameInfo*)arg;

    if (info->final &&
        info->index == 0 &&
        info->len == len &&
        info->opcode == WS_TEXT) {

      String message;

      for (size_t i = 0; i < len; i++) {
        message += (char)data[i];
      }

      Serial.print("WebSocket message: ");
      Serial.println(message);

      JsonDocument doc;

      DeserializationError error = deserializeJson(doc, message);

      if (error) {
        Serial.println("Invalid JSON command");
        return;
      }

      handleCommand(message, doc);
    }
  }
}

// =====================================================
//                    SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(500);

  Serial.println();
  Serial.println("=================================");
  Serial.println("       SMART HOME SYSTEM");
  Serial.println("=================================");

  // ---------------------------------------------------
  // GPIO SETUP
  // ---------------------------------------------------

  pinMode(RAIN_SENSOR_PIN, INPUT);

  pinMode(LED_PIN, OUTPUT);
  pinMode(FAN_RELAY_PIN, OUTPUT);

  digitalWrite(LED_PIN, LOW);
  digitalWrite(FAN_RELAY_PIN, LOW);

  // ---------------------------------------------------
  // SERVO SETUP
  // ---------------------------------------------------

  rackServo.setPeriodHertz(50);

  rackServo.attach(
    SERVO_PIN,
    500,
    2400
  );

  // Start outside (using SERVO_OUTSIDE_ANGLE constant)
  rackServo.write(SERVO_OUTSIDE_ANGLE);

  rackPosition = "OUTSIDE";
  targetRackPosition = "OUTSIDE";

  // ---------------------------------------------------
  // WIFI
  // ---------------------------------------------------

  WiFi.mode(WIFI_STA);

  WiFi.begin(
    WIFI_SSID,
    WIFI_PASSWORD
  );

  Serial.print("Connecting to WiFi");

  unsigned long wifiStart = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - wifiStart < 15000
  ) {

    delay(500);

    Serial.print(".");
  }

  Serial.println();

  // ---------------------------------------------------
  // WIFI CONNECTED
  // ---------------------------------------------------

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("WiFi connected!");

    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    // mDNS
    if (MDNS.begin(HOSTNAME)) {

      Serial.print("mDNS available at: http://");
      Serial.print(HOSTNAME);
      Serial.println(".local");
    }

  } else {

    Serial.println("WiFi connection failed.");
    Serial.println("Hardware will continue working.");
  }

  // ---------------------------------------------------
  // WEBSOCKET
  // ---------------------------------------------------

  ws.onEvent(onWebSocketEvent);

  server.addHandler(&ws);

  // ---------------------------------------------------
  // API STATUS
  // ---------------------------------------------------

  server.on(
    "/api/status",
    HTTP_GET,
    [](AsyncWebServerRequest *request) {

      AsyncWebServerResponse *response =
        request->beginResponse(
          200,
          "application/json",
          getStatusJSON()
        );

      response->addHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      request->send(response);
    }
  );

  // ---------------------------------------------------
  // API COMMAND
  // ---------------------------------------------------

  server.on(
    "/api/command",
    HTTP_POST,
    [](AsyncWebServerRequest *request) {

      // Body is handled below using onBody
    },
    NULL,
    [](AsyncWebServerRequest *request,
       uint8_t *data,
       size_t len,
       size_t index,
       size_t total) {

      if (index != 0 || len != total) {

        request->send(
          400,
          "application/json",
          "{\"error\":\"Request body must arrive in one piece\"}"
        );

        return;
      }

      String body;

      for (size_t i = 0; i < len; i++) {
        body += (char)data[i];
      }

      JsonDocument doc;

      DeserializationError error = deserializeJson(doc, body);

      if (error) {

        request->send(
          400,
          "application/json",
          "{\"error\":\"Invalid JSON\"}"
        );

        return;
      }

      handleCommand(body, doc);

      AsyncWebServerResponse *response =
        request->beginResponse(
          200,
          "application/json",
          getStatusJSON()
        );

      response->addHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      request->send(response);
    }
  );

  // ---------------------------------------------------
  // ROOT PAGE
  // ---------------------------------------------------

  server.on(
    "/",
    HTTP_GET,
    [](AsyncWebServerRequest *request) {

      String html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Smart Home System</title>
</head>

<body>

<h1>SMART HOME SYSTEM</h1>

<p>ESP32 Smart Home Controller is running.</p>

<p>
  Use the mobile/web dashboard to control
  the connected devices.
</p>

</body>
</html>
)rawliteral";

      request->send(
        200,
        "text/html",
        html
      );
    }
  );

  // ---------------------------------------------------
  // START SERVER
  // ---------------------------------------------------

  server.begin();

  Serial.println("Web server started.");
  Serial.println("=================================");
  Serial.println("System ready.");
}

// =====================================================
//                    MAIN LOOP
// =====================================================

void loop() {

  // Rain -> automatic rack control
  checkRainSensor();

  // Non-blocking servo movement
  updateRackMovement();

  // Clean disconnected WebSocket clients
  ws.cleanupClients();

  delay(10);
}
