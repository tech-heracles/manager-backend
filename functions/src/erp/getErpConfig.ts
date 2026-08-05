import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

export const getErpConfig = functions.onCall({
    region: "europe-west1",
  },async (request) => {
  const caller = request.auth;
  if (!caller) {
    throw new functions.HttpsError("unauthenticated", "Duhet te jesh i loguar.");
  }

  const companyId = caller.token.companyId;
  if (!companyId) {
    throw new functions.HttpsError("failed-precondition", "Perdoruesi nuk i perket asnje kompanie.");
  }

  const db = admin.firestore();
  const companySnap = await db.collection("companies").doc(companyId).get();
  const activeErpType = companySnap.data()?.activeErpType as string | undefined;

  if (!activeErpType) {
    return { configured: false };
  }

  const integrationSnap = await db
    .collection("companies")
    .doc(companyId)
    .collection("erpIntegrations")
    .doc(activeErpType)
    .get();

  if (!integrationSnap.exists) {
    return { configured: false };
  }

  const integrationData = integrationSnap.data() || {};
  const { password, ...safeConfig } = (integrationData.config as Record<string, unknown>) || {};

  return {
    configured: true,
    activeErpType,
    config: safeConfig,
    updatedAt: integrationData.updatedAt ?? null,
  };
});