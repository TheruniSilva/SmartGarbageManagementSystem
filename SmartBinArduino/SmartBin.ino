// Arduino code for a Smart Waste Bin with SMS Alerts
// This code is for Arduino Uno boards.

#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h> // <-- ADDED: For GSM module communication

// =================================================================
// ==== User-configurable Constants ================================
// =================================================================

// -- SMS Alert Configuration --
// IMPORTANT: Replace with the recipient's phone number in international format
const char* RECIPIENT_PHONE_NUMBER = "+94762921020"; 

// Define the sensor's distance reading when the bin is empty and full.
const float emptyBinDistance = 30.0;
const float fullBinDistance = 6.5;
const int lidOpenThreshold = 30; // Distance to user to open the lid (in inches)

// =================================================================
// ==== Hardware Pin Definitions ===================================
// =================================================================
LiquidCrystal_I2C lcd(0x27, 16, 2);

// -- GSM Module Pins --
// Connect SIM800L TX to Arduino pin A0
// Connect SIM800L RX to Arduino pin 13
const int gsmTxPin = A0; // Using an analog pin as a digital pin
const int gsmRxPin = 13;
SoftwareSerial gsmSerial(gsmTxPin, gsmRxPin); // <-- ADDED: Create a serial port for GSM

// Ultrasonic Pins
const int trigUser = 7;
const int echoUser = 6;
const int trigMetal = 3;
const int echoMetal = 4;
const int trigPlastic = 5;
const int echoPlastic = 8;

// Other Pins
const int proxSensorPin = 2;      // Proximity sensor
const int lidServoPin = 9;        // Servo 1: Lid
const int sortServoPin = 10;      // Servo 2: Sorting gate
const int redPin = 11;
const int greenPin = 12;

Servo lidServo;
Servo sortServo;

// =================================================================
// ==== State Variables ============================================
// =================================================================
bool lidOpen = false;
String lastDetectedMaterial = "None";

// -- SMS Alert State --
bool plasticAlertSent = false; // <-- ADDED: Flag to track if SMS for plastic bin has been sent
bool metalAlertSent = false;   // <-- ADDED: Flag to track if SMS for metal bin has been sent

// Emit JSON once every few seconds
static unsigned long lastJsonTs = 0;
const unsigned long JSON_INTERVAL_MS = 3000;

// =================================================================
// ==== Helper Functions ===========================================
// =================================================================

// Reads the distance from a given ultrasonic sensor and returns inches.
float readDistance(int trig, int echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long duration = pulseIn(echo, HIGH, 100000); // timeout ~100 ms
  return duration * 0.1133 / 2; // Conversion to inches
}

// Calculates the fill percentage using floating-point arithmetic.
int calculateFillLevel(float distance) {
  if (distance <= fullBinDistance) {
    return 100;
  }
  if (distance >= emptyBinDistance) {
    return 0;
  }
  int level = 100 - (int)(((distance - fullBinDistance) / (emptyBinDistance - fullBinDistance)) * 100);
  if (level < 0) return 0;
  if (level > 100) return 100;
  return level;
}

// =================================================================
// ==== NEW: SMS Functions =========================================
// =================================================================

// --- Gets a timestamp string ---
// NOTE: Arduino does not have a real-time clock. This is a placeholder.
// For accurate time, you must add an RTC module (e.g., DS3231).
String getTimestamp() {
  // This is a placeholder. It will always return the same date.
  // For a real application, integrate an RTC module here.
  return "2025-09-09_22-59-10"; 
}

// --- Sends the SMS message ---
void sendSms(String binType) {
  lcd.clear();
  lcd.print("Sending SMS...");
  
  // Construct the message body
  String message = "The " + binType + " bin on Level 1 is full. Please take immediate action.\n";
  message += "Time: " + getTimestamp();

  gsmSerial.println("AT+CMGF=1"); // Set SMS to text mode
  delay(1000);
  gsmSerial.println("AT+CMGS=\"" + String(RECIPIENT_PHONE_NUMBER) + "\"");
  delay(1000);
  gsmSerial.print(message); // Send the message body
  delay(100);
  gsmSerial.write(26); // Send Ctrl+Z character to send the SMS
  delay(1000);
  
  lcd.clear();
  lcd.print("SMS Sent!");
  delay(2000);
}

// =================================================================
// ==== Main Program ===============================================
// =================================================================

void setup() {
  pinMode(trigUser, OUTPUT);   pinMode(echoUser, INPUT);
  pinMode(trigMetal, OUTPUT);  pinMode(echoMetal, INPUT);
  pinMode(trigPlastic, OUTPUT);pinMode(echoPlastic, INPUT);
  pinMode(proxSensorPin, INPUT);
  pinMode(redPin, OUTPUT);     pinMode(greenPin, OUTPUT);

  lidServo.attach(lidServoPin);
  sortServo.attach(sortServoPin);
  lidServo.write(0);      // Lid closed
  sortServo.write(90);    // Neutral

  Serial.begin(9600);
  gsmSerial.begin(9600); // <-- ADDED: Start serial communication with GSM module
  delay(2000); // Wait for GSM module to initialize

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("System Ready");
}

void loop() {
  // 1) User detection (for lid)
  float userDist = readDistance(trigUser, echoUser);
  String lidStatus = (userDist > 0 && userDist <= lidOpenThreshold) ? "Open" : "Closed";

  if (userDist > 0 && userDist <= lidOpenThreshold && !lidOpen) {
    lidServo.write(90);
    lidOpen = true;
    lcd.clear(); lcd.setCursor(0, 0); lcd.print("Lid Opening...");
    delay(3000);

    // Material detection (proximity)
    int value = digitalRead(proxSensorPin);
    String materialDetected;
    lcd.clear();
    if (value == LOW) {
      lcd.setCursor(0, 0); lcd.print("Metal Detected");
      sortServo.write(45); // left
      materialDetected = "Metal";
    } else {
      lcd.setCursor(0, 0); lcd.print("Plastic Detected");
      sortServo.write(135); // right
      materialDetected = "Plastic";
    }
    
    lastDetectedMaterial = materialDetected;
    delay(1000);
    sortServo.write(90);
    lidServo.write(0);
    lidOpen = false;
    lcd.clear(); lcd.setCursor(0, 0); lcd.print("Lid Closed");
    delay(1500);
    lcd.clear(); lcd.setCursor(0, 0); lcd.print("System Ready");
  }

  // 2) Bin levels
  float metalDist = readDistance(trigMetal, echoMetal);
  float plasticDist = readDistance(trigPlastic, echoPlastic);
  int metalLevel = calculateFillLevel(metalDist);
  int plasticLevel = calculateFillLevel(plasticDist);

  // 3) Status
  String metalStatus = (metalLevel >= 80) ? "Full" : "Filling";
  String plasticStatus = (plasticLevel >= 80) ? "Full" : "Filling";
  if (metalLevel == 0) metalStatus = "Empty";
  if (plasticLevel == 0) plasticStatus = "Empty";

  // 4) LED status
  if (metalLevel >= 80 || plasticLevel >= 80) {
    digitalWrite(redPin, LOW);   // RED ON (active LOW wiring)
    digitalWrite(greenPin, HIGH);
  } else {
    digitalWrite(redPin, HIGH); // RED OFF
    digitalWrite(greenPin, LOW);  // GREEN ON
  }

  // 5) Emit one compact JSON line over Serial
  unsigned long now = millis();
  if (now - lastJsonTs >= JSON_INTERVAL_MS) {
    Serial.print("ARDUINO_DATA:");
    Serial.print("{\"lid\":\""); Serial.print(lidStatus); Serial.print("\",");
    Serial.print("\"materialDetected\":\""); Serial.print(lastDetectedMaterial); Serial.print("\",");
    Serial.print("\"metal\":{");
    Serial.print("\"level\":"); Serial.print(metalLevel); Serial.print(",");
    Serial.print("\"status\":\""); Serial.print(metalStatus); Serial.print("\"");
    Serial.print("},");
    Serial.print("\"plastic\":{");
    Serial.print("\"level\":"); Serial.print(plasticLevel); Serial.print(",");
    Serial.print("\"status\":\""); Serial.print(plasticStatus); Serial.print("\"");
    Serial.print("}");
    Serial.println("}");
    lastJsonTs = now;
    lastDetectedMaterial = "None";
  }

  // =================================================================
  // ==== NEW: SMS Alert Logic =======================================
  // =================================================================
  // Check plastic bin
  if (plasticLevel >= 80 && !plasticAlertSent) {
    sendSms("Plastic");
    plasticAlertSent = true; // Set flag to prevent sending again
  } else if (plasticLevel < 80) {
    plasticAlertSent = false; // Reset flag when bin is no longer full
  }

  // Check metal bin
  if (metalLevel >= 80 && !metalAlertSent) {
    sendSms("Metal");
    metalAlertSent = true; // Set flag to prevent sending again
  } else if (metalLevel < 80) {
    metalAlertSent = false; // Reset flag when bin is no longer full
  }

  delay(50); // small loop delay
}