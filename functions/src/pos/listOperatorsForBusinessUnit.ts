import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface ListOperatorsForBusinessUnitData {
  companyId: string;
  businessUnitId: string;
}

// Pashtjelluar - kartat e operatoreve duhen para se dikush te kete bere sign
// in. `email` eshte adresa sintetike qe klienti e perdor per
// signInWithEmailAndPassword(email, pin) - s'ka kuptim pa PIN-in e sakte.
export const listOperatorsForBusinessUnit = functions.onCall({
  region: "europe-west1",
}, async (request) => {
  const data = request.data as ListOperatorsForBusinessUnitData;
  if (!data.companyId || !data.businessUnitId) {
    throw new functions.HttpsError("invalid-argument", "Mungojne fusha te detyrueshme: companyId, businessUnitId.");
  }

  const snap = await admin
    .firestore()
    .collection("companies")
    .doc(data.companyId)
    .collection("users")
    .where("role", "==", "operator")
    .where("businessUnitIds", "array-contains", data.businessUnitId)
    .get();

  const operators = snap.docs
    .filter((d) => d.data().status !== "inactive")
    .map((d) => ({
      uid: d.id,
      displayName: d.data().displayName as string,
      email: d.data().authEmail as string,
    }));

  return { operators };
});
