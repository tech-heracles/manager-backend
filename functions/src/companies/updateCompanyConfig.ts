// functions/src/companies/updateCompanyConfig.ts
import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface UpdateCompanyConfigData {
    name: string;
    address?: string | null;
    phone?: string | null;
    nipt?: string | null;
    currency?: string;
}

export const updateCompanyConfig = functions.onCall({
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
        throw new functions.HttpsError("permission-denied", "Vetem Admin mund te ndryshoje konfigurimet e kompanise.");
    }

    const data = request.data as UpdateCompanyConfigData;

    if (!data.name || !data.name.trim()) {
        throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: name.");
    }

    await admin.firestore().collection("companies").doc(companyId).set(
        {
            name: data.name.trim(),
            address: data.address?.trim() || null,
            phone: data.phone?.trim() || null,
            nipt: data.nipt?.trim() || null,
            currency: data.currency || "ALL",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    return { ok: true };
});