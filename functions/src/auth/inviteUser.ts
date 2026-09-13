import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

if (admin.apps.length === 0) admin.initializeApp();

interface InviteUserData {
  companyId: string;
  displayName: string;
  role: "admin" | "supervisor" | "operator";
  businessUnitIds?: string[];
  email?: string; // required for admin/supervisor
  pin?: string; // required for operator, exactly 6 digits
}

const PIN_PATTERN = /^\d{6}$/;

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
  if (!data.displayName || !data.displayName.trim() || !data.role) {
    throw new functions.HttpsError("invalid-argument", "Mungojne fusha te detyrueshme: displayName, role.");
  }

  const isOperator = data.role === "operator";

  let email: string;
  let password: string;

  if (isOperator) {
    if (!data.pin || !PIN_PATTERN.test(data.pin)) {
      throw new functions.HttpsError("invalid-argument", "Operatori ka nevoje per nje PIN 6-shifror.");
    }
    // Operatoret hyjne me PIN ne POS, jo me email - gjenerojme nje adrese
    // sintetike vetem sa per te plotesuar kerkesen e Firebase Auth per nje
    // identifikues unik; operatori s'e sheh dhe s'e perdor kurre.
    email = `op.${crypto.randomBytes(8).toString("hex")}@${data.companyId}.operators.local`;
    password = data.pin;
  } else {
    if (!data.email || !data.email.trim()) {
      throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: email.");
    }
    email = data.email.trim();
    // Fjalekalim i perkohshem; useri e vendos vetin permes reset link-ut.
    password = Math.random().toString(36).slice(-10) + "A1!";
  }

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: data.displayName.trim(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gabim i panjohur";
    throw new functions.HttpsError("internal", `Krijimi i perdoruesit deshtoi: ${message}`);
  }

  // Write the Firestore user doc — this triggers onUserWrite to set claims
  await admin
    .firestore()
    .collection("companies")
    .doc(data.companyId)
    .collection("users")
    .doc(userRecord.uid)
    .set({
      displayName: data.displayName.trim(),
      email: isOperator ? null : email,
      // Retrievable server-side (e.g. by listOperatorsForBusinessUnit for
      // POS sign-in) without surfacing the meaningless synthetic address in
      // the Manager Users screen, which reads "email" only.
      authEmail: isOperator ? email : null,
      role: data.role,
      businessUnitIds: data.businessUnitIds || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  if (isOperator) {
    // No reset link for operators - the PIN the Admin just set is already
    // active, so we just hand it back to display/share once.
    return { uid: userRecord.uid, pin: data.pin };
  }

  // Generate a password reset link so the new user can set their own password
  const resetLink = await admin.auth().generatePasswordResetLink(email);

  return {
    uid: userRecord.uid,
    resetLink, // for MVP: show this to the Admin to share manually; later, email it
  };
});
