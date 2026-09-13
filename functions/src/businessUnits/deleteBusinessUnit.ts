import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface DeleteBusinessUnitData {
  businessUnitId: string;
}

export const deleteBusinessUnit = functions.onCall({
  region: "europe-west1",
}, async (request) => {
  const caller = request.auth;
  if (!caller) {
    throw new functions.HttpsError("unauthenticated", "Duhet te jesh i loguar.");
  }

  const companyId = caller.token.companyId;
  const role = caller.token.role;

  if (!companyId) {
    throw new functions.HttpsError("failed-precondition", "Perdoruesi nuk i perket asnje kompanie.");
  }
  if (role !== "admin") {
    throw new functions.HttpsError("permission-denied", "Vetem Admin mund te fshije nje Business Unit.");
  }

  const data = request.data as DeleteBusinessUnitData;
  if (!data.businessUnitId) {
    throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: businessUnitId.");
  }

  const buRef = admin
    .firestore()
    .collection("companies")
    .doc(companyId)
    .collection("businessUnits")
    .doc(data.businessUnitId);

  const snap = await buRef.get();
  if (!snap.exists) {
    throw new functions.HttpsError("not-found", "Business Unit nuk u gjet.");
  }

  // onBusinessUnitDelete trigger pastron subcollection-in "pos" pas kesaj.
  await buRef.delete();

  return { ok: true };
});
