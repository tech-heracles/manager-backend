import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface InviteUserData {
  companyId: string;
  email: string;
  displayName: string;
  role: "admin" | "supervisor" | "operator";
  businessUnitIds?: string[];
}

export const inviteUser = functions.onCall({
  region: "europe-west1",
}, async (request) => {
  const caller = request.auth;

  if (!caller) {
    throw new functions.HttpsError("unauthenticated", "Duhet te jesh i loguar.");
  }

  const callerRole = caller.token.role;
  const callerCompanyId = caller.token.companyId;

  if (callerRole !== "admin") {
    throw new functions.HttpsError("permission-denied", "Vetem Admin mund te krijoje perdorues.");
  }

  const data = request.data as InviteUserData;

  if (!data.companyId || data.companyId !== callerCompanyId) {
    throw new functions.HttpsError("permission-denied", "Nuk mund te krijosh perdorues per nje kompani tjeter.");
  }

  if (!data.email || !data.displayName || !data.role) {
    throw new functions.HttpsError("invalid-argument", "Mungojne fusha te detyrueshme: email, displayName, role.");
  }

  // Create the Auth user with a temporary password; they'll reset it on first login
  const tempPassword = Math.random().toString(36).slice(-10) + "A1!";

  const userRecord = await admin.auth().createUser({
    email: data.email,
    password: tempPassword,
    displayName: data.displayName,
  });

  // Write the Firestore user doc — this triggers onUserWrite to set claims
  await admin
    .firestore()
    .collection("companies")
    .doc(data.companyId)
    .collection("users")
    .doc(userRecord.uid)
    .set({
      displayName: data.displayName,
      email: data.email,
      role: data.role,
      businessUnitIds: data.businessUnitIds || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // Generate a password reset link so the new user can set their own password
  const resetLink = await admin.auth().generatePasswordResetLink(data.email);

  return {
    uid: userRecord.uid,
    resetLink, // for MVP: show this to the Admin to share manually; later, email it
  };
});