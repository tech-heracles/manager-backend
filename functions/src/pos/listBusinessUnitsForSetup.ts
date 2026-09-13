import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface ListBusinessUnitsForSetupData {
  companyId: string;
}

// Pashtjelluar, si listCompaniesForSetup - hap parak POS-i para se te kete
// nje sesion Firebase.
export const listBusinessUnitsForSetup = functions.onCall({
  region: "europe-west1",
}, async (request) => {
  const data = request.data as ListBusinessUnitsForSetupData;
  if (!data.companyId) {
    throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: companyId.");
  }

  const snap = await admin
    .firestore()
    .collection("companies")
    .doc(data.companyId)
    .collection("businessUnits")
    .orderBy("name")
    .get();

  return {
    businessUnits: snap.docs.map((d) => ({ id: d.id, name: d.data().name as string })),
  };
});
