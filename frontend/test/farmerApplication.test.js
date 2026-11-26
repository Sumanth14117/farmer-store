import test from "node:test";
import assert from "node:assert/strict";
import { applicationNextStep, applicationPayload, applicationSections, applicationStatusLabel, emptyFarmerApplication, validateFarmerApplication } from "../src/farmerApplicationModel.js";
import { createFarmerApplication, getAdminFarmerApplications, getMyFarmerApplication, reviewFarmerApplication, submitFarmerApplication, updateFarmerApplication } from "../src/api.js";

test("onboarding model validates required fields and optional coordinates", () => {
  assert.deepEqual(validateFarmerApplication(emptyFarmerApplication), Object.fromEntries(["farm_name", "full_name", "contact_phone", "farm_description", "farm_address", "state", "district", "city_village", "pincode", "farming_type", "primary_crops", "farm_size", "farm_size_unit", "years_experience", "farming_practices"].map(key => [key, "This field is required"])));
  const values = { ...emptyFarmerApplication, farm_name: "Farm", full_name: "Farmer", contact_phone: "+91 98765 43210", farm_description: "Mixed farm", farm_address: "Farm lane", state: "Karnataka", district: "Mysuru", city_village: "Nanjangud", pincode: "570001", farming_type: "individual_farmer", primary_crops: "Rice", farm_size: "1.5", farm_size_unit: "acre", years_experience: "3", farming_practices: "Crop rotation" };
  assert.deepEqual(validateFarmerApplication(values), {});
  assert.equal(applicationPayload(values).farm_size, 1.5);
  assert.equal(applicationPayload(values).latitude, null);
  assert.equal(validateFarmerApplication({ ...values, pincode: "57A001" }).pincode, "Enter a six-digit Indian PIN code");
  assert.match(validateFarmerApplication({ ...values, latitude: "12" }).latitude, /both coordinates/);
  assert.equal(applicationSections.length, 5);
});
test("application status labels and next actions cover all workflow states", () => {
  assert.equal(applicationStatusLabel("needs_changes"), "Changes requested");
  assert.match(applicationNextStep("pending"), /administrator/);
  assert.match(applicationNextStep("rejected"), /new revision/);
  assert.match(applicationNextStep("approved"), /access is active/);
});
test("farmer application client methods use shared auth and expected routes", async () => {
  const oldFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, options) => { seen.push([String(url), options.method || "GET", options.body]); return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }); };
  try {
    await getMyFarmerApplication(); await createFarmerApplication({ farm_name: "Farm" }); await updateFarmerApplication({ farm_name: "Farm" }); await submitFarmerApplication(); await getAdminFarmerApplications({ status: "pending", q: "Green Farm" }); await reviewFarmerApplication(7, "request-changes", "Add more details please.");
    assert.ok(seen[0][0].endsWith("/farmer-applications/me"));
    assert.equal(seen[1][1], "POST");
    assert.equal(seen[2][1], "PATCH");
    assert.equal(seen[3][0].endsWith("/farmer-applications/me/submit"), true);
    assert.match(seen[4][0], /status=pending/);
    assert.match(seen[4][0], /q=Green\+Farm/);
    assert.ok(seen[5][0].endsWith("/admin/farmer-applications/7/request-changes"));
  } finally { globalThis.fetch = oldFetch; }
});
