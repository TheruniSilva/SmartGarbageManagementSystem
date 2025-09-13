// js/auth.js

import { auth } from './firebase-init.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');
const errorMessage = document.getElementById('errorMessage');

// Check authentication state on page load
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, redirect to dashboard
        window.location.href = 'dashboard.html';
    }
});

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent default form submission

        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            // Sign in user with email and password
            await signInWithEmailAndPassword(auth, email, password);
            // If successful, redirect to dashboard
            window.location.href = 'dashboard.html';
        } catch (error) {
            // Handle login errors
            console.error("Login Error:", error.code, error.message);
            errorMessage.textContent = getFriendlyErrorMessage(error.code);
            errorMessage.classList.remove('hidden');
        }
    });
}

// Function to toggle password visibility
if (togglePassword) {
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        // Toggle eye icon
        togglePassword.querySelector('i').classList.toggle('fa-eye');
        togglePassword.querySelector('i').classList.toggle('fa-eye-slash');
    });
}

// Helper function to provide user-friendly error messages
function getFriendlyErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Invalid email address format.';
        case 'auth/user-disabled':
            return 'This account has been disabled.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Invalid email or password.';
        case 'auth/too-many-requests':
            return 'Too many login attempts. Please try again later.';
        default:
            return 'An unexpected error occurred. Please try again.';
    }
}
