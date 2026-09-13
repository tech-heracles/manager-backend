import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

// I pashtjelluar (pa request.auth) - pajisja POS s'ka ende sesion Firebase ne
// kete hap te setup-it. Kthen vetem emrin, asnje te dhene sensitive.
export const listCompaniesForSetup = functions.onCall({
  region: "europe-west1",
}, async () => {
  const snap = await admin.firestore().collection("companies").orderBy("name").limit(200).get();
  return {
    companies: snap.docs.map((d) => ({ id: d.id, name: d.data().name as string })),
  };
});
