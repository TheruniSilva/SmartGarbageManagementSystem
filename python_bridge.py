import serial
import time
import json
import os
import firebase_admin
from firebase_admin import credentials, db
from datetime import datetime

# --- Configuration Constants ---
# Replace with the path to your service account key file
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FIREBASE_KEY_PATH = os.path.join(SCRIPT_DIR, 'smartwastedashboard-firebase-adminsdk-fbsvc-7377698687.json')
# Replace with your Firebase database URL
FIREBASE_DATABASE_URL = 'https://smartwastedashboard-default-rtdb.asia-southeast1.firebasedatabase.app'
# Replace with your Arduino's serial port
SERIAL_PORT = 'COM7' # Example for Windows, use '/dev/ttyACM0' for Linux/macOS
BAUD_RATE = 9600

# A prefix to identify data lines from the Arduino
# The Arduino code should print this before the JSON string
ARDUINO_DATA_PREFIX = 'ARDUINO_DATA:'

# Initialize Firebase Admin SDK
try:
    cred = credentials.Certificate(FIREBASE_KEY_PATH)
    firebase_admin.initialize_app(cred, {
        'databaseURL': FIREBASE_DATABASE_URL
    })
    print("Firebase Admin SDK initialized successfully.")
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    exit()

# Connect to the Arduino's serial port
try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    time.sleep(2) # Wait for the serial connection to establish
    print(f"Successfully connected to Arduino on {SERIAL_PORT}")
except serial.SerialException as e:
    print(f"Error: Could not open serial port {SERIAL_PORT}. Please check the port and ensure the Arduino is connected.")
    print(e)
    exit()

# Get a reference to the main 'bin1' node
ref = db.reference('bin1')

def send_data_to_firebase(data):
    """
    Sends the received data to the main 'bin1' node and creates a log entry
    for new detections.
    """
    try:
        # If a material was just detected, create a log entry
        if 'materialDetected' in data and data['materialDetected'] != 'None':
            material = data['materialDetected']
            
            # --- FIX: Get the correct status for the log entry ---
            log_status = 'N/A'
            if material == "Plastic":
                # Get status from the nested 'plastic' object
                log_status = data['plastic']['status']
            elif material == "Metal":
                # Get status from the nested 'metal' object
                log_status = data['metal']['status']
            
            log_ref = db.reference('bin1/logs').push()
            log_data = {
                'material': material,
                'status': log_status, # Use the correct status from the Arduino data
                'time': datetime.now().isoformat()
            }
            log_ref.set(log_data)
            print(f"Logged new detection: {material} with status: {log_status}")
            
            # Remove the materialDetected key so it doesn't stay in the main data
            del data['materialDetected']

        # Update data in the main bin node
        ref.update(data)
        print("Main bin status updated successfully.")
    except Exception as e:
        print(f"Error sending data to Firebase: {e}")

# Main loop to read from serial and send to Firebase
while True:
    try:
        line = ser.readline().decode('utf-8').strip()
        if line and line.startswith(ARDUINO_DATA_PREFIX):
            json_string = line[len(ARDUINO_DATA_PREFIX):] # Extract JSON part
            print(f"Received from Arduino: {json_string}")
            
            # Parse the JSON string from Arduino
            try:
                parsed_data = json.loads(json_string)
                send_data_to_firebase(parsed_data)
            except json.JSONDecodeError as e:
                print(f"JSON parsing failed: {e}")
                print(f"Invalid JSON string received: {json_string}")
    
    except serial.SerialTimeoutException:
        pass # Silently ignore timeouts to keep the loop running
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
