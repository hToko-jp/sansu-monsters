// Firebase Configuration
// This file contains the connection settings for your Firebase project.
const firebaseConfig = {
    apiKey: "AIzaSyDhePsbzObaE91wzG0cKNhDpXm1xmdK_o4",
    authDomain: "fir-pro-babfd.firebaseapp.com",
    projectId: "fir-pro-babfd",
    storageBucket: "fir-pro-babfd.firebasestorage.app",
    messagingSenderId: "517736474622",
    appId: "1:517736474622:web:a6702bbf7007a591f8c2af",
    measurementId: "G-83309CP6R5",
    databaseURL: "https://fir-pro-babfd-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
} else {
    console.error("Firebase SDK not loaded!");
}
