/**
 * Firebase Web SDK — client-side Firestore for lead capture. Uses the SAME
 * project (jhax-ai) as Firebase Auth. Config comes from PUBLIC_FIREBASE_* env
 * (public by design; access is controlled by Firestore security rules).
 *
 * Nothing here throws at import time: if config is missing, `firebaseEnabled` is
 * false and the lead form surfaces a friendly error instead of crashing.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

const cfg = {
	apiKey: env.PUBLIC_FIREBASE_API_KEY,
	authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN,
	databaseURL: env.PUBLIC_FIREBASE_DATABASE_URL,
	projectId: env.PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: env.PUBLIC_FIREBASE_APP_ID
};

export const firebaseEnabled = Boolean(cfg.apiKey && cfg.projectId);

/** @type {import('firebase/firestore').Firestore | null} */
let db = null;

// Initialize only in the browser (this is a static SPA — no server runtime).
if (browser && firebaseEnabled) {
	const app = getApps().length ? getApp() : initializeApp(cfg);
	db = getFirestore(app);
} else if (browser && !firebaseEnabled && typeof console !== 'undefined') {
	console.warn('[firebase] PUBLIC_FIREBASE_* not set — lead capture disabled. Fill .env and rebuild.');
}

export { db };
