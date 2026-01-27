const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccount.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    console.error("Usage: node scripts/setCaptainRole.js <UID>");
    process.exit(1);
  }

  await admin.auth().setCustomUserClaims(uid, { role: "CAPTAIN" });

  // verify immediately
  const user = await admin.auth().getUser(uid);
  console.log("✅ Set role=CAPTAIN for:", user.uid);
  console.log("✅ Current customClaims:", user.customClaims);

  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
