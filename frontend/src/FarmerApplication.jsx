import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createFarmerApplication, getMyFarmerApplication, submitFarmerApplication, updateFarmerApplication } from "./api";
import { applicationNextStep, applicationPayload, applicationSections, applicationStatusLabel, emptyFarmerApplication, validateFarmerApplication } from "./farmerApplicationModel";
import { useAuth } from "./useAuth";

const labels = { farm_name: "Farm or business name", full_name: "Your full name", contact_phone: "Contact phone", farm_description: "About your farm", farm_address: "Farm address", state: "State", district: "District", city_village: "City or village", pincode: "PIN code", latitude: "Latitude (optional)", longitude: "Longitude (optional)", farming_type: "Farming type", primary_crops: "Primary crops", additional_crop_info: "Additional crop information (optional)", farm_size: "Farm size", farm_size_unit: "Size unit", years_experience: "Years of farming experience", farming_practices: "Farming practices" };
const sectionsFields = { personal: ["full_name", "contact_phone"], farm: ["farm_name", "farm_description"], location: ["farm_address", "state", "district", "city_village", "pincode", "latitude", "longitude"], farming: ["farming_type", "primary_crops", "additional_crop_info", "farm_size", "farm_size_unit", "years_experience", "farming_practices"] };
function toForm(application) {
  const result = { ...emptyFarmerApplication };
  for (const key of Object.keys(result)) if (application?.[key] != null) result[key] = String(application[key]);
  return result;
}
function Field({ name, value, onChange, error }) {
  const isText = ["farm_description", "farm_address", "primary_crops", "additional_crop_info", "farming_practices"].includes(name);
  const label = labels[name];
  let input;
  if (name === "farming_type") input = <select id={name} value={value} onChange={onChange}><option value="">Choose a type</option><option value="individual_farmer">Individual farmer</option><option value="family_owned_farm">Family-owned farm</option><option value="farmer_group">Farmer group</option><option value="agricultural_business">Agricultural business</option></select>;
  else if (name === "farm_size_unit") input = <select id={name} value={value} onChange={onChange}><option value="">Choose a unit</option><option value="acre">Acres</option><option value="hectare">Hectares</option></select>;
  else if (isText) input = <textarea id={name} value={value} onChange={onChange} rows={3} maxLength={name === "farm_address" ? 300 : 1200} />;
  else input = <input id={name} value={value} onChange={onChange} type={name === "farm_size" || name === "years_experience" || name === "latitude" || name === "longitude" ? "number" : "text"} inputMode={name === "pincode" ? "numeric" : undefined} maxLength={name === "pincode" ? 6 : undefined} step={name === "latitude" || name === "longitude" ? "any" : name === "farm_size" ? "0.01" : undefined} />;
  return <label className="farmer-field" htmlFor={name}>{label}{!name.includes("optional") && !["latitude", "longitude", "additional_crop_info"].includes(name) && <span aria-hidden="true"> *</span>}{input}{error && <span className="field-error" role="alert">{error}</span>}</label>;
}
function StatusPanel({ application }) {
  const status = application?.status;
  return <section className="farmer-status-card" aria-live="polite"><div className={`farmer-status-mark status-${status || "none"}`} aria-hidden="true">{status === "approved" ? "✓" : status === "rejected" ? "!" : "•"}</div><div><p className="eyebrow">Application status</p><h2>{applicationStatusLabel(status)}</h2><p>{applicationNextStep(status)}</p>{application?.submitted_at && <p className="muted">Submitted {new Date(application.submitted_at).toLocaleString()}</p>}{application?.admin_feedback && <div className="farmer-feedback"><strong>Administrator feedback</strong><p>{application.admin_feedback}</p></div>}{status === "rejected" && application?.rejection_reason && <div className="farmer-feedback"><strong>Reason for rejection</strong><p>{application.rejection_reason}</p></div>}{status === "approved" && <Link className="button-link" to="/store">Continue to Farmer Store</Link>}</div></section>;
}
export default function FarmerApplication() {
  const { user } = useAuth();
  const [application, setApplication] = useState(null), [values, setValues] = useState(emptyFarmerApplication), [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [fieldErrors, setFieldErrors] = useState({}), [notice, setNotice] = useState("");
  const editable = !application || ["draft", "needs_changes", "rejected"].includes(application.status);
  const completion = useMemo(() => Object.keys(validateFarmerApplication(values)).length === 0, [values]);
  useEffect(() => { let live = true; getMyFarmerApplication().then(({ application: data }) => { if (live) { setApplication(data); setValues(toForm(data)); } }).catch(e => { if (live) setError(e.message || "Unable to load your application"); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, []);
  function change(name, value) { setValues(current => ({ ...current, [name]: value })); setFieldErrors(current => ({ ...current, [name]: "" })); }
  async function saveDraft(payload = applicationPayload(values)) {
    let result;
    if (!application || application.status === "rejected") result = await createFarmerApplication(payload);
    else result = await updateFarmerApplication(payload);
    setApplication(result.application);
    return result.application;
  }
  async function save() {
    setError(""); setNotice(""); setSaving(true);
    try { await saveDraft(); setNotice("Your draft has been saved."); }
    catch (e) { setError(e.message || "Unable to save your draft"); }
    finally { setSaving(false); }
  }
  async function submit(event) {
    event.preventDefault(); setError(""); setNotice("");
    const errors = validateFarmerApplication(values); setFieldErrors(errors);
    if (Object.keys(errors).length) { setError("Please complete the highlighted fields before submitting."); const invalid = Object.keys(errors)[0]; const index = applicationSections.findIndex(section => (sectionsFields[section.id] || []).includes(invalid)); if (index >= 0) setStep(index); return; }
    setSaving(true);
    try { await saveDraft(applicationPayload(values)); const result = await submitFarmerApplication(); setApplication(result.application); setNotice("Application submitted for administrator review."); }
    catch (e) { setError(e.message || "Unable to submit your application"); }
    finally { setSaving(false); }
  }
  if (loading) return <p className="page-state" role="status">Loading farmer application…</p>;
  const fields = sectionsFields[applicationSections[step].id] || [];
  return <section className="content-page farmer-application-page"><p className="eyebrow">Farmer verification</p><h1>Become a Farmer</h1><p className="farmer-intro">Verification helps shoppers understand who grows the food they buy. Share details about you and your farm. Submitting does not grant farmer privileges: an administrator reviews every application first. No identity or banking documents are requested.</p>
    {application && <StatusPanel application={application} />}
    {user?.role === "farmer" || application?.status === "approved" ? null : <>
      <ol className="farmer-progress" aria-label="Application sections">{applicationSections.map((section, index) => <li key={section.id} className={index === step ? "current" : index < step ? "complete" : ""}><span>{index + 1}</span><span>{section.title}</span></li>)}</ol>
      <form className="farmer-form" onSubmit={submit} noValidate><fieldset disabled={!editable || saving} className="farmer-fieldset"><section className="farmer-form-section"><div className="section-heading"><div><p className="eyebrow">Section {step + 1} of {applicationSections.length}</p><h2>{applicationSections[step].title}</h2></div></div>
      {applicationSections[step].id === "review" ? <div className="farmer-review-summary"><p>Confirm your details before submitting. Contact email will be taken from your signed-in account: <strong>{user?.email}</strong>.</p>{applicationSections.slice(0, 4).map(section => <div key={section.id}><h3>{section.title}</h3><dl>{(sectionsFields[section.id] || []).map(key => <div key={key}><dt>{labels[key]}</dt><dd>{values[key] || "Not provided"}{key === "farm_size" && values.farm_size_unit ? ` ${values.farm_size_unit}${values.farm_size === "1" ? "" : "s"}` : ""}</dd></div>)}</dl></div>)}<p className="muted">You can save a draft and return before submitting. Your customer account stays unchanged while an administrator reviews your application.</p></div> : <div className="farmer-fields-grid">{fields.map(name => <Field key={name} name={name} value={values[name]} onChange={event => change(name, event.target.value)} error={fieldErrors[name]} />)}</div>}
      {error && <p className="state-error" role="alert">{error}</p>}{notice && <p className="farmer-notice" role="status">{notice}</p>}
      <div className="farmer-form-actions">{step > 0 && <button type="button" className="secondary-button" disabled={saving} onClick={() => setStep(step - 1)}>Back</button>}{editable && step < applicationSections.length - 1 && <button type="button" className="secondary-button" disabled={saving} onClick={() => setStep(step + 1)}>Continue</button>}{editable && <button type="button" className="secondary-button" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save draft"}</button>}{editable && step === applicationSections.length - 1 && <button type="submit" className="primary-button" disabled={saving || !completion}>{saving ? "Submitting…" : "Submit for review"}</button>}</div>
      </section></fieldset></form>
      {!editable && application && <p className="empty-state">This application is read-only while it is awaiting review.</p>}
    </>}
    {application?.events?.length > 0 && <section className="farmer-history"><h2>Application activity</h2><ol>{application.events.map(event => <li key={event.id}><strong>{applicationStatusLabel(event.to_status)}</strong><span>{new Date(event.created_at).toLocaleString()}</span>{event.comments && <p>{event.comments}</p>}</li>)}</ol></section>}
  </section>;
}
