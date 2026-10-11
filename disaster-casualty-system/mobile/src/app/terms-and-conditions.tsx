import LegalDocumentScreen from "../components/common/LegalDocumentScreen";

export default function TermsAndConditionsScreen() {
  return (
    <LegalDocumentScreen
      title="Terms and Conditions"
      updatedAt="October 11, 2026"
      intro="By using MedSORT, you agree to use the system only for authorized disaster response, casualty documentation, incident management, reporting, and related official duties."
      sections={[
        {
          title: "Authorized Use",
          bullets: [
            "Use only your assigned account and keep credentials confidential.",
            "Access only records necessary for your official role and assigned scope.",
            "Enter accurate, timely, and complete information to the best of your knowledge.",
            "Do not use MedSORT for personal, unauthorized, or non-operational purposes.",
          ],
        },
        {
          title: "Sensitive Information",
          body: "MedSORT may contain sensitive incident, casualty, healthcare, responder, and operational information. Users must handle all data with care and avoid unauthorized copying, screenshots, exports, or disclosure.",
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
          body: "MedSORT may be updated, temporarily unavailable, or modified as needed for maintenance, security, operational requirements, or deployment changes.",
        },
        {
          title: "Questions",
          body: "For questions about these terms, contact the system administrator or responsible emergency management office.",
        },
      ]}
    />
  );
}
