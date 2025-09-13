// js/main.js
import { database } from './firebase-init.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// This is a global flag to prevent sending multiple alerts for the same event.
let plasticAlertSent = false;
let metalAlertSent = false;

// Realtime Database listener for main bin data
const dbRef = ref(database, 'bin1');
onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        console.log("Received new data:", data);

        // Correctly get the fill levels for the metal and plastic bins
        const metalFill = data.metal.level;
        const plasticFill = data.plastic.level;

        // Log the bin statuses for debugging
        console.log(`Plastic bin status: ${data.plastic.status}, Fill level: ${plasticFill}%`);
        console.log(`Metal bin status: ${data.metal.status}, Fill level: ${metalFill}%`);

        // Check if the plastic bin needs an alert (at or above 80%)
        if (plasticFill >= 80 && !plasticAlertSent) {
            // Use a fetch request to call your Cloud Function and trigger the SMS
            fetch('https://us-central1-smartwastedashboard.cloudfunctions.net/sendAlert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    binType: 'plastic',
                    fillLevel: plasticFill
                }),
            })
            .then(response => {
                // Check if the response is successful and readable as JSON
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Alert sent for plastic bin:', data);
                // Set the flag to true to prevent a new alert from being sent
                plasticAlertSent = true;
            })
            .catch((error) => console.error('Error sending alert:', error));
        }
        
        // Reset the flag if the bin is no longer full
        if (plasticFill < 80) {
            plasticAlertSent = false;
        }

        // Check if the metal bin needs an alert (at or above 80%)
        if (metalFill >= 80 && !metalAlertSent) {
            // Use a fetch request to call your Cloud Function and trigger the SMS
            fetch('https://us-central1-smartwastedashboard.cloudfunctions.net/sendAlert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    binType: 'metal',
                    fillLevel: metalFill
                }),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Alert sent for metal bin:', data);
                metalAlertSent = true;
            })
            .catch((error) => console.error('Error sending alert:', error));
        }

        // Reset the flag if the bin is no longer full
        if (metalFill < 80) {
            metalAlertSent = false;
        }
    }
}, (error) => {
    console.error("Firebase Read Error:", error);
});
