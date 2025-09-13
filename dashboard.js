// js/dashboard.js

// Firebase imports
import { auth, database } from './firebase-init.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// DOM Elements
const updateTimeElem = document.getElementById('updateTime');
const lidStatusElem = document.getElementById('lidStatus');
const lastDetectionTimeElem = document.getElementById('lastDetectionTime');

const plasticFillCircle = document.getElementById('plasticFillCircle');
const plasticFillLevelElem = document.getElementById('plasticFillLevel');
const plasticStatusElem = document.getElementById('plasticStatus');

const metalFillCircle = document.getElementById('metalFillCircle');
const metalFillLevelElem = document.getElementById('metalFillLevel');
const metalStatusElem = document.getElementById('metalStatus');

const compositionPlasticElem = document.getElementById('compositionPlastic');
const progressPlasticElem = document.getElementById('progressPlastic');
const compositionMetalElem = document.getElementById('compositionMetal');
const progressMetalElem = document.getElementById('progressMetal');

const detectionLogBody = document.getElementById('detectionLogBody');
const alertBox = document.getElementById('alertBox');
const alertMessage = document.getElementById('alertMessage');
const logoutButton = document.getElementById('logoutButton');
const refresh = document.getElementById('refresh');

// Global flags to prevent sending multiple alerts for the same event
let plasticAlertSent = false;
let metalAlertSent = false;

// --- Authentication State Management ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        console.log("User is signed in:", user.uid);
        loadDashboardData();
        loadDetectionLogs();
    }
});

// --- Logout Functionality ---
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            console.log("User signed out successfully.");
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Logout Error:", error);
        }
    });
}

// --- Realtime Database Listener for main data ---
function loadDashboardData() {
    const dbRef = ref(database, 'bin1');
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            console.log("Received new data:", data);
            
            // Update main status card
            const { lid, lastUpdated, lastDetected } = data;
            lidStatusElem.textContent = lid;
            updateTimeElem.textContent = `Updated: ${new Date(lastUpdated).toLocaleTimeString()}`;

            // Fallback for last detection time from the main node
            if (lastDetected) {
                lastDetectionTimeElem.textContent = new Date(lastDetected).toLocaleTimeString();
            }

            // Update plastic and metal card data
            const plasticData = data.plastic || {};
            const metalData = data.metal || {};
            
            updateBinCard(plasticFillCircle, plasticFillLevelElem, plasticStatusElem, plasticData.level, plasticData.status, 'plastic');
            updateBinCard(metalFillCircle, metalFillLevelElem, metalStatusElem, metalData.level, metalData.status, 'metal');
            
            // Update compositions (assuming 50/50 split for now)
            const totalLevel = (plasticData.level || 0) + (metalData.level || 0);
            const plasticPercentage = totalLevel > 0 ? ((plasticData.level || 0) / totalLevel) * 100 : 0;
            const metalPercentage = totalLevel > 0 ? ((metalData.level || 0) / totalLevel) * 100 : 0;
            
            compositionPlasticElem.textContent = `${plasticPercentage.toFixed(0)}%`;
            progressPlasticElem.style.width = `${plasticPercentage}%`;
            
            compositionMetalElem.textContent = `${metalPercentage.toFixed(0)}%`;
            progressMetalElem.style.width = `${metalPercentage}%`;

            // Check for and send alerts based on fill levels
            checkForAlerts(plasticData.level, 'plastic');
            checkForAlerts(metalData.level, 'metal');

            // Show alert for "Full" bins on the dashboard itself
            if (plasticData.status === 'Full' || metalData.status === 'Full') {
                showAlert('One or more bins are full!', 'yellow');
            } else {
                hideAlert();
            }
        }
    }, (error) => {
        console.error("Firebase Read Error:", error);
        showAlert('Could not connect to Firebase!', 'red');
    });
}

// --- Detection Log Data Loading ---
function loadDetectionLogs() {
    // Reference to the 'logs' node in your Firebase Realtime Database
    const logsRef = ref(database, 'bin1/logs');

    // Listen for real-time changes to the 'logs' data
    onValue(logsRef, (snapshot) => {
        const logsData = snapshot.val();
        if (logsData) {
            console.log("Detection Log Data:", logsData);
            // Convert the object of logs into an array of logs
            const logsArray = Object.values(logsData);
            populateDetectionLog(logsArray);
        } else {
            console.log("No logs available at 'bin1/logs' path.");
            detectionLogBody.innerHTML = ''; // Clear the log table
        }
    }, (error) => {
        console.error("Error fetching logs from Firebase:", error);
    });
}

// Function to check fill level and send alert if needed
function checkForAlerts(fillLevel, binType) {
    let alertSentFlag = binType === 'plastic' ? plasticAlertSent : metalAlertSent;

    if (fillLevel >= 80 && !alertSentFlag) {
        console.log(`Bin level for ${binType} is ${fillLevel}%. Attempting to send SMS alert.`);
        fetch('https://us-central1-smartwastedashboard.cloudfunctions.net/sendAlert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                binType: binType,
                fillLevel: fillLevel
            }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`Alert sent for ${binType} bin:`, data);
            if (binType === 'plastic') {
                plasticAlertSent = true;
            } else {
                metalAlertSent = true;
            }
        })
        .catch((error) => console.error(`Error sending alert for ${binType} bin:`, error));
    }
    
    // Reset the flag if the bin is no longer full
    if (fillLevel < 80) {
        if (binType === 'plastic') {
            plasticAlertSent = false;
        } else {
            metalAlertSent = false;
        }
    }
}

// Function to update a single bin card
function updateBinCard(circleElem, levelElem, statusElem, fillPercent, status, material) {
    const color = material === 'plastic' ? 'orange' : 'red';
    
    circleElem.style.setProperty('--fill-percentage', `${fillPercent}%`);
    
    // Ensure fillPercent is a valid number before displaying
    if (!isNaN(fillPercent) && fillPercent !== null) {
        levelElem.textContent = `${Math.round(fillPercent)}%`;
    } else {
        levelElem.textContent = 'N/A';
    }

    statusElem.textContent = status;
    statusElem.classList.value = getStatusBadgeClass(status, color);
}

// Helper function to get status badge class
function getStatusBadgeClass(status, color) {
    let baseClass = `bg-${color}-100 text-${color}-700 text-xs font-semibold px-2.5 py-0.5 rounded-full`;
    if (status === 'Full') {
        return `bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-0.5 rounded-full`;
    }
    return baseClass;
}

// Function to populate the detection log table
function populateDetectionLog(logs) {
    detectionLogBody.innerHTML = ''; // Clear existing logs
    if (!logs || logs.length === 0) {
        return;
    }
    // Sort logs by time in descending order (newest first)
    const sortedLogs = logs.sort((a, b) => {
        const timeA = new Date(a.time);
        const timeB = new Date(b.time);
        if (isNaN(timeA) || isNaN(timeB)) {
            return 0; // Don't sort if dates are invalid
        }
        return timeB - timeA;
    });

    sortedLogs.forEach(log => {
        const row = document.createElement('tr');
        // Check for undefined or invalid values before rendering
        const logTime = log.time ? new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Invalid Date';
        const material = log.material || 'N/A';
        const status = log.status || 'N/A';
        
        row.innerHTML = `
            <td class="py-3 px-4">${logTime}</td>
            <td class="py-3 px-4 flex items-center">
                <i class="fas ${material === 'Plastic' ? 'fa-recycle text-orange-500' : 'fa-cube text-red-500'} mr-2"></i>
                ${material}
            </td>
            <td class="py-3 px-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(status, material === 'Plastic' ? 'orange' : 'red')}">
                    ${status}
                </span>
            </td>
        `;
        detectionLogBody.appendChild(row);
    });
}

// --- Alert Functions (unchanged) ---
function showAlert(message, color) {
    alertMessage.textContent = message;
    alertBox.classList.remove('hidden');
    alertBox.classList.add(`bg-${color}-100`, `border-${color}-400`, `text-${color}-700`);
}

function hideAlert() {
    alertBox.classList.add('hidden');
}

// Initial refresh button functionality (optional)
if (refresh) {
    refresh.addEventListener('click', () => {
        console.log("Manual refresh triggered.");
    });
}
