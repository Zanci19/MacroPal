import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const env = await initializeTestEnvironment({
  projectId: "macropal-rules-test",
  firestore: {
    rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
});

const ATTACKER = "attacker-uid";
const VICTIM = "victim-uid";

let pass = 0;
let fail = 0;
const check = async (name, fn) => {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    pass++;
  } catch (e) {
    console.log(`  FAIL  ${name}\n        ${e.message.split("\n")[0]}`);
    fail++;
  }
};

// Seed: both users exist with the default role, victim has health data.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "users", ATTACKER), { role: "user", profile: {} });
  await setDoc(doc(db, "users", VICTIM), {
    role: "user",
    profile: { weightKg: 82, name: "Victim" },
  });
  await setDoc(doc(db, "users", VICTIM, "foods", "2026-07-19"), {
    breakfast: [{ name: "oats", kcal: 300 }],
  });
});

const attacker = env.authenticatedContext(ATTACKER).firestore();
const victim = env.authenticatedContext(VICTIM).firestore();

console.log("\n--- privilege escalation (the vulnerability) ---");

await check("attacker CANNOT self-promote to admin", () =>
  assertFails(updateDoc(doc(attacker, "users", ATTACKER), { role: "admin" }))
);

await check("attacker CANNOT self-promote to clinician", () =>
  assertFails(updateDoc(doc(attacker, "users", ATTACKER), { role: "clinician" }))
);

await check("attacker CANNOT smuggle role in a multi-field update", () =>
  assertFails(
    updateDoc(doc(attacker, "users", ATTACKER), {
      role: "admin",
      profile: { name: "innocent" },
    })
  )
);

await check("attacker CANNOT create a NEW user doc pre-set to admin", async () => {
  const fresh = env.authenticatedContext("fresh-uid").firestore();
  await assertFails(setDoc(doc(fresh, "users", "fresh-uid"), { role: "admin" }));
});

console.log("\n--- the payoff the escalation unlocked ---");

await check("attacker CANNOT self-assign the victim", () =>
  assertFails(
    setDoc(doc(attacker, "users", ATTACKER, "assignedUsers", VICTIM), { uid: VICTIM })
  )
);

await check("attacker CANNOT read victim's profile", () =>
  assertFails(getDoc(doc(attacker, "users", VICTIM)))
);

await check("attacker CANNOT read victim's food log", () =>
  assertFails(getDoc(doc(attacker, "users", VICTIM, "foods", "2026-07-19")))
);

console.log("\n--- legitimate behaviour must still work (regression guard) ---");

await check("user CAN update their own profile", () =>
  assertSucceeds(
    updateDoc(doc(victim, "users", VICTIM), { profile: { weightKg: 81 } })
  )
);

await check("user CAN write role:'user' (the ClinicianConnect merge path)", () =>
  assertSucceeds(
    setDoc(
      doc(victim, "users", VICTIM),
      { role: "user", clinicianLink: { status: "active" } },
      { merge: true }
    )
  )
);

await check("new user CAN create their doc with role:'user'", async () => {
  const fresh = env.authenticatedContext("fresh2-uid").firestore();
  await assertSucceeds(
    setDoc(doc(fresh, "users", "fresh2-uid"), { role: "user", profile: {} })
  );
});

await check("user CAN read their own data", () =>
  assertSucceeds(getDoc(doc(victim, "users", VICTIM)))
);

await check("an admin's existing role survives an unrelated profile update", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", "real-admin"), {
      role: "admin",
      profile: {},
    });
  });
  const admin = env.authenticatedContext("real-admin").firestore();
  await assertSucceeds(
    updateDoc(doc(admin, "users", "real-admin"), { profile: { name: "Dr A" } })
  );
  let roleAfter;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore(), "users", "real-admin"));
    roleAfter = snap.data().role;
  });
  assert.equal(roleAfter, "admin", "admin role was clobbered");
});

console.log("\n--- clinician assignment requires patient consent ---");

const CLINICIAN = "clinician-uid";
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), "users", CLINICIAN), { role: "clinician" });
});
const clinician = env.authenticatedContext(CLINICIAN).firestore();

await check("clinician CANNOT self-assign a patient who never consented", () =>
  assertFails(
    setDoc(doc(clinician, "users", CLINICIAN, "assignedUsers", VICTIM), {
      uid: VICTIM,
    })
  )
);

await check("patient CAN accept an invite (the ClinicianConnect flow)", () =>
  assertSucceeds(
    setDoc(
      doc(victim, "users", CLINICIAN, "assignedUsers", VICTIM),
      { uid: VICTIM, assignedAt: "2026-07-19" },
      { merge: true }
    )
  )
);

await check("patient CANNOT assign themselves to a non-clinician", () =>
  assertFails(
    setDoc(doc(victim, "users", ATTACKER, "assignedUsers", VICTIM), { uid: VICTIM })
  )
);

await check("patient CAN revoke their own assignment", () =>
  assertSucceeds(deleteDoc(doc(victim, "users", CLINICIAN, "assignedUsers", VICTIM)))
);

console.log("\n--- pairing code enumeration and deletion ---");

await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), "pairingCodes", "12345678"), {
    ownerUid: VICTIM,
    ownerName: "Victim",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
});

await check("attacker CANNOT list all pairing codes to harvest uids", () =>
  assertFails(getDocs(collection(attacker, "pairingCodes")))
);

await check("attacker CANNOT delete someone else's pairing code", () =>
  assertFails(deleteDoc(doc(attacker, "pairingCodes", "12345678")))
);

await check("a redeemer CAN still look up a code they were given", () =>
  assertSucceeds(getDoc(doc(attacker, "pairingCodes", "12345678")))
);

await check("owner CAN delete their own pairing code", () =>
  assertSucceeds(deleteDoc(doc(victim, "pairingCodes", "12345678")))
);

await check("attacker CANNOT list clinician invites", () =>
  assertFails(getDocs(collection(attacker, "clinicianInvites")))
);

await env.cleanup();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
