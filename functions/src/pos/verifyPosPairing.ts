import * as functions from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface VerifyPosPairingData {
  companyId: string;
  businessUnitId: string;
  code: string;
}

// Temporary bypass while real email delivery isn't wired up yet (see
// requestPosPairing's TODO): entering this code always pairs the device,
// skipping the emailed-code check entirely. Stored in Secret Manager, not
// in source, and known only to whoever it's shared with directly. Remove
// once requestPosPairing actually sends email.
const masterCode = defineSecret("POS_PAIRING_MASTER_CODE");

export const verifyPosPairing = functions.onCall({
  region: "europe-west1",
  secrets: [masterCode],
}, async (request) => {
  const data = request.data as VerifyPosPairingData;
  if (!data.companyId || !data.businessUnitId || !data.code) {
    throw new functions.HttpsError("invalid-argument", "Mungojne fusha te detyrueshme: companyId, businessUnitId, code.");
  }

  if (data.code === masterCode.value()) {
    return { ok: true };
  }

  const buRef = admin
    .firestore()
    .collection("companies")
    .doc(data.companyId)
    .collection("businessUnits")
    .doc(data.businessUnitId);

  const snap = await buRef.get();
  if (!snap.exists) {
    throw new functions.HttpsError("not-found", "Business Unit nuk u gjet.");
  }

  const pending = snap.data()?.pendingPairing as { code: string; expiresAt: number } | undefined;

  if (!pending) {
    throw new functions.HttpsError("failed-precondition", "S'ka asnje kod aktiv. Kerko nje kod te ri.");
  }
  if (Date.now() > pending.expiresAt) {
    await buRef.update({ pendingPairing: admin.firestore.FieldValue.delete() });
    throw new functions.HttpsError("deadline-exceeded", "Kodi ka skaduar. Kerko nje kod te ri.");
  }
  if (pending.code !== data.code) {
    throw new functions.HttpsError("invalid-argument", "Kodi i pasakte.");
  }

  await buRef.update({ pendingPairing: admin.firestore.FieldValue.delete() });

  return { ok: true };
});
