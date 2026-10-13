const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const getFirebaseAuth = () => {
	const projectId = process.env.FIREBASE_PROJECT_ID;
	const firebaseApp = getApps()[0] || initializeApp({ projectId });
	return getAuth(firebaseApp);
};

module.exports = { getFirebaseAuth };