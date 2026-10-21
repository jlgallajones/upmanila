import LegalDocumentScreen from "../components/common/LegalDocumentScreen";

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      updatedAt="October 11, 2026"
      intro="SCRIBER supports disaster casualty management, responder coordination, incident analytics, and official situation reporting. This policy explains the information handled by the system and the expected safeguards for authorized users."
      sections={[
        {
          title: "Information We Collect",
          bullets: [
            "Account details such as name, role, office or organization, contact details, and login activity.",
            "Incident records including location, timeline entries, status updates, and operational notes.",
            "Casualty records including triage, treatment, transport, facility, morbidity, mortality, and related timestamps.",
            "Photos, attachments, and draft/offline records when submitted by authorized users.",
            "System logs used for security, audit, troubleshooting, and accountability.",
          ],
        },
        {
          title: "How Information Is Used",
          bullets: [
            "To coordinate emergency response and casualty documentation.",
            "To support verification, analytics, SitRep generation, exports, and official reporting.",
            "To maintain account security, prevent unauthorized access, and investigate system issues.",
            "To preserve operational history required for incident review and continuity.",
          ],
        },
        {
          title: "Access and Sharing",
          body: "Access is limited to authorized accounts based on assigned role and administrative scope. Information may be shared with authorized emergency management, healthcare, or oversight personnel when needed for response operations, reporting, or legal compliance.",
        },
        {
          title: "Data Protection",
          body: "Users must protect their credentials, avoid unnecessary disclosure of sensitive data, and access records only for official purposes. System activity may be logged and reviewed.",
        },
        {
          title: "Retention",
          body: "Records may be retained for incident documentation, audit, reporting, system recovery, and operational review according to applicable organizational policies.",
        },
        {
          title: "Contact",
          body: "For privacy concerns or correction requests, contact the system administrator or the responsible emergency management office.",
        },
      ]}
    />
  );
}
