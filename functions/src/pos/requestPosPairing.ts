import * as functions from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface RequestPosPairingData {
  companyId: string;
  businessUnitId: string;
}

const PAIRING_TTL_MS = 10 * 60 * 1000; // 10 minuta

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const requestPosPairing = functions.onCall({
  region: "europe-west1",
}, async (request) => {
  const data = request.data as RequestPosPairingData;
  if (!data.companyId || !data.businessUnitId) {
    throw new functions.HttpsError("invalid-argument", "Mungojne fusha te detyrueshme: companyId, businessUnitId.");
  }

  const db = admin.firestore();
  const buRef = db
    .collection("companies")
    .doc(data.companyId)
    .collection("businessUnits")
    .doc(data.businessUnitId);

  const buSnap = await buRef.get();
  if (!buSnap.exists) {
    throw new functions.HttpsError("not-found", "Business Unit nuk u gjet.");
  }

  const code = generateCode();
  const expiresAt = Date.now() + PAIRING_TTL_MS;

  await buRef.update({
    pendingPairing: { code, expiresAt },
  });

  const usersRef = db.collection("companies").doc(data.companyId).collection("users");
  const [adminsSnap, supervisorsSnap] = await Promise.all([
    usersRef.where("role", "==", "admin").get(),
    usersRef.where("role", "==", "supervisor").where("businessUnitIds", "array-contains", data.businessUnitId).get(),
  ]);

  const recipients = [...adminsSnap.docs, ...supervisorsSnap.docs]
    .map((d) => d.data().email as string | null)
    .filter((email): email is string => !!email);

  // TODO: dergim real email (SMTP/SendGrid/Resend ose Firebase "Trigger Email"
  // extension). Deri sa te kemi kredencialet, kodi logohet ketu ne mënyrë qe
  // te mund te merret nga `firebase functions:log` per testim.
  logger.info("POS pairing code requested", {
    companyId: data.companyId,
    businessUnitId: data.businessUnitId,
    code,
    recipients,
  });

  return { ok: true, emailedTo: recipients.length };
});
