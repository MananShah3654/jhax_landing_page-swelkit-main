/**
 * Lead capture — writes form submissions to the Firestore `leads` collection from
 * the browser. Replaces the old POST /api/leads backend route. Stores the exact
 * same fields the backend stored (no field dropped); `created_at` is a Firestore
 * server timestamp. Firestore security rules (firestore.rules) enforce required
 * fields and block reads/updates/deletes from clients.
 */
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase.js';

/**
 * @param {{ email: string, source?: string, business_name?: string|null,
 *   person_name?: string|null, phone?: string|null }} fields
 */
export async function saveLead(fields) {
	if (!firebaseEnabled || !db) {
		throw new Error('Lead storage is not configured');
	}
	const lead = {
		email: fields.email,
		source: fields.source || 'final_cta',
		business_name: fields.business_name ?? null,
		person_name: fields.person_name ?? null,
		phone: fields.phone ?? null,
		created_at: serverTimestamp()
	};
	await addDoc(collection(db, 'leads'), lead);
	return lead;
}
