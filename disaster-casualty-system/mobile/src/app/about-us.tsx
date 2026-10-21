import LegalDocumentScreen from "../components/common/LegalDocumentScreen";

export default function AboutUsScreen() {
  return (
    <LegalDocumentScreen
      title="About Us"
      updatedAt="October 21, 2026"
      intro="SCRIBER is a product of the UP Manila Disaster Risk Reduction and Management in Health Program, in collaboration with the Department of Science and Technology, and the Philippine Council for Health Research and Development. The mobile and web applications were developed to improve the disaster documentation process in the Philippines by adopting the Utstein template for uniform data reporting in acute medical response during disasters."
      sections={[
        {
          title: "About SCRIBER",
          body: "SCRIBER emphasizes the systematic documentation of casualties and emergency response activities, highlighting the application's holistic role in promoting consistent, reliable, and standardized disaster reporting. Hence the application's name: Standardized Casualty Reporting for Incidents and Basic Emergency Response. The development process of the tool started in 2026 by engaging with software developers from TechFactors Inc. The tools were developed primarily referencing the disaster medical response data elements elaborated in Debacker et al. (2012)1.",
        },
        {
          title: "Reference",
          body: "1Debacker, M., Hubloue, I., Dhondt, E., Rockenschaub, G., Rüter, A., Codeanu, T., ... & Castrén, M. (2012). Utstein-style template for uniform data reporting of acute medical response in disasters. PLoS currents, 4, e4f6cf3e8df15a. https://doi.org/10.1371/4f6cf3e8df15a",
        },
      ]}
    />
  );
}
