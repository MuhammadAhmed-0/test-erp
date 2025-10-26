async function register(email, password, role) {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    await db.collection('users').doc(user.uid).set({
      email,
      role,
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