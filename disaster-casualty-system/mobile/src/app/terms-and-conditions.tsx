import LegalDocumentScreen from "../components/common/LegalDocumentScreen";

export default function TermsAndConditionsScreen() {
  return (
    <LegalDocumentScreen
      title="Terms and Conditions"
      updatedAt="October 11, 2026"
      intro="By using SCRIBER, you agree to use the system only for authorized disaster responses, victim documentation, incident management, reporting, and in compliance with the following terms and conditions."
      sections={[
        {
          title: "Authorized Use",
          bullets: [
            "Use only your assigned account and keep credentials confidential.",
            "Access only records necessary for your official role and assigned scope.",
            "Enter accurate, timely, and complete information to the best of your knowledge.",
            "Do not use SCRIBER for personal, unauthorized, or non-operational purposes.",
          ],
        },
        {
          title: "Sensitive",
          body: "SCRIBER may contain sensitive incident, victim, healthcare, responder, and operational information. Users must handle all data with care and avoid unauthorized copying, screenshots, exports, or disclosure.",
        },
        {
          title: "Offline and Draft Records",
          body: "Some mobile workflows may store drafts or queued records on the device until they are submitted. Users are responsible for safeguarding the device and syncing records when connectivity and authorization are available.",
        },
        {
          title: "Audit and Monitoring",
          body: "Login activity, record changes, approvals, exports, and other actions may be logged for security, accountability, troubleshooting, and incident review.",
        },
        {
          title: "Prohibited Actions",
          bullets: [
            "Attempting to bypass authentication, role restrictions, or approval workflows.",
            "Submitting false, malicious, or intentionally misleading records.",
            "Sharing system data with unauthorized persons or public channels.",
            "Interfering with system availability, integrity, or security.",
          ],
        },
        {
          title: "Availability and Changes",
          body: "SCRIBER may be updated, temporarily unavailable, or modified as needed for maintenance, security, operational requirements, or deployment changes. Accounts may be suspended or terminated access to SCRIBER if the terms and conditions are violated or if the user poses risk to the system or to others.",
        },
        {
          title: "Questions",
          body: "For questions about these terms and conditions, you may contact the UP Manila Disaster Risk Reduction and Management in Health Program via upm-drrmh-list@up.edu.ph",
        },
      ]}
    />
  );
}
