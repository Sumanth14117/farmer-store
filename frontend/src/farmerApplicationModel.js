export const applicationSections = [
  { id: "personal", title: "Personal information" },
  { id: "farm", title: "Farm or business" },
  { id: "location", title: "Farm location" },
  { id: "farming", title: "Crops and farming" },
  { id: "review", title: "Review and submit" },
];
export const emptyFarmerApplication = {
  farm_name: "", full_name: "", contact_phone: "", farm_description: "", farm_address: "",
  state: "", district: "", city_village: "", pincode: "", latitude: "", longitude: "",
  farming_type: "", primary_crops: "", additional_crop_info: "", farm_size: "",
  farm_size_unit: "", years_experience: "", farming_practices: "",
};
export function validateFarmerApplication(values) {
  const required = ["farm_name", "full_name", "contact_phone", "farm_description", "farm_address", "state", "district", "city_village", "pincode", "farming_type", "primary_crops", "farm_size", "farm_size_unit", "years_experience", "farming_practices"];
  const errors = {};
  for (const field of required) if (values[field] === "" || values[field] == null) errors[field] = "This field is required";
  if (values.pincode && !/^\d{6}$/.test(values.pincode)) errors.pincode = "Enter a six-digit Indian PIN code";
  if (values.farming_type && !["individual_farmer", "family_owned_farm", "farmer_group", "agricultural_business"].includes(values.farming_type)) errors.farming_type = "Choose a valid farming type";
  if (values.farm_size_unit && !["acre", "hectare"].includes(values.farm_size_unit)) errors.farm_size_unit = "Choose acres or hectares";
  if (values.contact_phone && !/^\+?[\d ()-]{7,30}$/.test(values.contact_phone)) errors.contact_phone = "Enter a valid phone number";
  if (values.farm_size && (!Number.isFinite(Number(values.farm_size)) || Number(values.farm_size) <= 0)) errors.farm_size = "Enter a positive farm size";
  if (values.years_experience !== "" && (!Number.isInteger(Number(values.years_experience)) || Number(values.years_experience) < 0 || Number(values.years_experience) > 100)) errors.years_experience = "Use a value from 0 to 100";
  const latEmpty = values.latitude === "" || values.latitude == null;
  const lonEmpty = values.longitude === "" || values.longitude == null;
  if (latEmpty !== lonEmpty) errors.latitude = "Enter both coordinates or leave both blank";
  if (!latEmpty && (!Number.isFinite(Number(values.latitude)) || Number(values.latitude) < -90 || Number(values.latitude) > 90)) errors.latitude = "Latitude must be between -90 and 90";
  if (!lonEmpty && (!Number.isFinite(Number(values.longitude)) || Number(values.longitude) < -180 || Number(values.longitude) > 180)) errors.longitude = "Longitude must be between -180 and 180";
  return errors;
}
export function applicationPayload(values) {
  return { ...values, latitude: values.latitude === "" ? null : Number(values.latitude), longitude: values.longitude === "" ? null : Number(values.longitude), farm_size: values.farm_size === "" ? null : Number(values.farm_size), years_experience: values.years_experience === "" ? null : Number(values.years_experience), farming_type: values.farming_type || null, farm_size_unit: values.farm_size_unit || null };
}
export const applicationStatusLabel = status => ({ draft: "Draft", pending: "Pending review", needs_changes: "Changes requested", approved: "Approved", rejected: "Rejected" }[status] || "Not started");
export const applicationNextStep = status => ({ draft: "Complete the form and submit it for administrator review.", pending: "Your application is with an administrator. Your customer access remains unchanged until approval.", needs_changes: "Review the administrator feedback, update your application, then submit it again.", approved: "Farmer access is active. Sign in again if your current session was open during approval.", rejected: "Your application was not approved. Read the reason below; you may start a new revision." }[status] || "Start an application to request farmer verification.");
