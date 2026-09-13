import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface ZoneTable {
  id: string;
  name: string;
}

interface Zone {
  id: string;
  name: string;
  tables: ZoneTable[];
}

interface CreateBusinessUnitData {
  name: string;
  address?: string;
  code?: string;
  defaultCustomerCode?: string;
  defaultLocationCode?: string;
  visibleItemGroupCodes?: string[] | null;
  salesMode?: "simple" | "tables";
  zones?: Zone[];
}

function sanitizeZones(zones: Zone[] | undefined): Zone[] {
  if (!Array.isArray(zones)) return [];
  return zones
    .filter((z) => z && typeof z.id === "string" && typeof z.name === "string")
    .map((z) => ({
      id: z.id,
      name: z.name.trim(),
      tables: Array.isArray(z.tables)
        ? z.tables
            .filter((t) => t && typeof t.id === "string" && typeof t.name === "string")
            .map((t) => ({ id: t.id, name: t.name.trim() }))
        : [],
    }));
}

export const createBusinessUnit = functions.onCall({
    region: "europe-west1",
  },async (request) => {
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
    throw new functions.HttpsError("permission-denied", "Vetem Admin mund te krijoje Business Unit.");
  }

  const data = request.data as CreateBusinessUnitData;
  if (!data.name || !data.name.trim()) {
    throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: name.");
  }

  const buRef = admin
    .firestore()
    .collection("companies")
    .doc(companyId)
    .collection("businessUnits")
    .doc();

  await buRef.set({
    name: data.name.trim(),
    address: data.address?.trim() || null,
    code: data.code?.trim() || null,
    defaultCustomerCode: data.defaultCustomerCode || null,
    defaultLocationCode: data.defaultLocationCode || null,
    visibleItemGroupCodes: data.visibleItemGroupCodes || null,
    salesMode: data.salesMode === "tables" ? "tables" : "simple",
    zones: sanitizeZones(data.zones),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { businessUnitId: buRef.id };
});