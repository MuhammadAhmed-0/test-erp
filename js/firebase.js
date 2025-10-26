// ✅ Prevent re-initialization or duplicate variable errors
if (typeof firebase === 'undefined') {
  console.error('Firebase SDK not loaded!');
} else {
  // Only define config once
  if (typeof window.firebaseConfig === 'undefined') {
    window.firebaseConfig = {
      apiKey: "AIzaSyB2M-i2mYsrquyqSj7e_8CuEqrv94CE_Hs",
      authDomain: "erp-e-33e34.firebaseapp.com",
      projectId: "erp-e-33e34",
      storageBucket: "erp-e-33e34.firebasestorage.app",
      messagingSenderId: "91382577611",
      appId: "1:91382577611:web:73a2c2aef061820cd89e4e",
      measurementId: "G-ZYG3N43LBL"
    };
  }

  // Initialize only once
  if (!firebase.apps.length) {
    firebase.initializeApp(window.firebaseConfig);
  }

  // Expose globally (but only once)
  window.auth = firebase.auth();
  window.db = firebase.firestore();
}
