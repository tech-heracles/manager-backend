import * as functions from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

export const onBusinessUnitDelete = functions.onDocumentDeleted(
  "companies/{companyId}/businessUnits/{buId}",
  
  async (event) => {
    const { companyId, buId } = event.params;

    const posSnapshot = await admin
      .firestore()
      .collection("companies")
      .doc(companyId)
      .collection("businessUnits")
      .doc(buId)
      .collection("pos")
      .get();

    const batch = admin.firestore().batch();
    posSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
);