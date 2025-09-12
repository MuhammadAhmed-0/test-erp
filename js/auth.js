async function register(email, password) {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    // Security: All new users are hardcoded as members. Admin elevation must be done by existing admin.
    await db.collection('users').doc(user.uid).set({
      email,
      role: 'member', // Hardcoded - cannot be overridden by client
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return user;
  } catch (error) {
    alert(error.message);
  }
}

async function login(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    alert(error.message);
  }
}

function onAuthStateChanged(callback) {
  auth.onAuthStateChanged(callback);
}