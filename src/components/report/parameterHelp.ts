const PARAMETER_HELP: Record<string, string> = {
  rbc: "The number of red blood cells that carry oxygen around the body.",
  hemoglobin: "The oxygen-carrying protein inside red blood cells.",
  hematocrit: "The percentage of blood made up of red blood cells.",
  mcv: "The average size of red blood cells.",
  wbc: "The number of white blood cells that help fight infection.",
  platelet: "The number of cells that help blood form clots.",
  "bilirubin-total": "A yellow waste product processed by the liver.",
  alt: "A liver enzyme that can rise when liver cells are irritated or damaged.",
  ast: "An enzyme found in the liver and other tissues; high levels may show tissue injury.",
  alp: "An enzyme linked mainly to the liver, bile ducts, and bones.",
  t3: "A thyroid hormone that helps control the body's energy use.",
  t4: "A thyroid hormone that helps control metabolism and body temperature.",
  tsh: "The hormone that tells the thyroid how much thyroid hormone to make.",
  color: "The visible color of the urine sample.",
  appearance: "Whether the urine looks clear or cloudy.",
  protein: "Checks whether protein is leaking into the urine.",
  glucose: "Checks whether sugar is present in the urine.",
  ph: "Shows how acidic or alkaline the urine is.",
  urea: "A waste product removed from the blood by the kidneys.",
  creatinine: "A muscle waste product used to assess kidney filtering.",
  "uric-acid":
    "A waste product from breaking down certain foods and body cells.",
  "total-cholesterol": "The total amount of cholesterol in the blood.",
  triglycerides: "A type of fat in the blood used for energy storage.",
  "hdl-cholesterol":
    "The HDL cholesterol that helps carry excess cholesterol away.",
  "ldl-cholesterol": "The LDL cholesterol that can build up in artery walls.",
  "hba1c-percent":
    "An estimate of the average blood sugar over the last two to three months.",
  "estimated-average-glucose":
    "The HbA1c result expressed as an estimated average blood sugar.",
  sodium: "A mineral that helps control fluid balance and nerve signals.",
  potassium: "A mineral important for muscles, nerves, and heart rhythm.",
  chloride: "A mineral that helps maintain fluid and acid balance.",
  "crp-value":
    "A protein that often rises when there is inflammation in the body.",
  "esr-value": "A simple blood test that can rise with inflammation.",
  "reticulocyte-percent": "The percentage of young red blood cells being made.",
  "smear-findings":
    "A description of the size, shape, and appearance of blood cells.",
  "abo-group": "The person's ABO blood group: A, B, AB, or O.",
  "rh-factor":
    "Shows whether the person's blood is Rh-positive or Rh-negative.",
  "prothrombin-time":
    "The time it takes blood to form a clot through one clotting pathway.",
  inr: "A standardised version of the clotting-time result, often used for warfarin monitoring.",
  "aptt-value":
    "The time it takes blood to form a clot through another clotting pathway.",
  "d-dimer-value":
    "A substance released when the body breaks down a blood clot.",
  ferritin: "A protein that reflects the body's stored iron.",
  "serum-iron": "The amount of iron currently circulating in the blood.",
  tibc: "Shows how much iron the blood could carry; it helps assess iron deficiency.",
  calcium: "A mineral needed for bones, muscles, nerves, and heart function.",
  magnesium: "A mineral needed for muscles, nerves, and many body reactions.",
  phosphate:
    "A mineral that works with calcium for bones and energy production.",
  amylase:
    "An enzyme that helps digest carbohydrates, made mainly by the pancreas and salivary glands.",
  lipase: "An enzyme that helps digest fats, made mainly by the pancreas.",
  "troponin-value":
    "A heart muscle protein; raised levels may indicate heart muscle injury.",
  "urine-rbc":
    "The number of red blood cells seen under the microscope in urine.",
  "urine-wbc":
    "The number of white blood cells seen under the microscope in urine.",
  "urine-crystals":
    "Mineral crystals or tube-shaped casts seen in the urine sediment.",
  "urine-hcg": "Checks for the pregnancy hormone hCG in urine.",
  "urine-culture-result": "Shows whether bacteria grew from the urine sample.",
  "urine-sensitivity":
    "Shows which antibiotics may work against the grown bacteria.",
  "blood-culture-result": "Shows whether germs grew from the blood sample.",
  "blood-sensitivity":
    "Shows which antibiotics may work against the grown germ.",
  "wound-organism": "Names any germ grown from the wound swab.",
  "wound-sensitivity":
    "Shows which antibiotics may work against the wound germ.",
  "hiv-result":
    "Screens for evidence of HIV infection; reactive results need confirmation.",
  "hbsag-result": "Screens for a surface protein of hepatitis B virus.",
  "anti-hcv-result":
    "Screens for antibodies showing possible exposure to hepatitis C.",
  "dengue-ns1": "Looks for a dengue virus protein, usually early in infection.",
  "dengue-igm":
    "Looks for IgM antibodies that can appear after a recent dengue infection.",
  "malaria-antigen": "Looks for proteins from malaria parasites in the blood.",
  "mp-card-pv": "A rapid card test for Plasmodium vivax (PV) malaria.",
  "mp-card-pf": "A rapid card test for Plasmodium falciparum (PF) malaria.",
  "fasting-insulin":
    "The insulin level after fasting; insulin helps control blood sugar.",
  "cortisol-value":
    "A hormone involved in stress response, blood pressure, and energy balance.",
  "prolactin-value":
    "A hormone involved in breast development and milk production.",
  fsh: "A hormone involved in egg or sperm production.",
  lh: "A hormone involved in ovulation or testosterone production.",
  "testosterone-value":
    "A sex hormone involved in reproductive development and function.",
  "vitamin-d-value":
    "The body's stored form of vitamin D, important for bones and calcium use.",
  "biopsy-findings":
    "What the pathologist sees in the tissue under the microscope.",
  "biopsy-diagnosis":
    "The pathologist's overall interpretation of the tissue sample.",
  "pap-adequacy":
    "Whether the Pap smear sample contains enough suitable cells to assess.",
  "pap-interpretation":
    "The pathologist's interpretation of the cervical cells.",
  "fnac-findings":
    "What the pathologist sees in cells collected by a fine needle.",
  "fnac-diagnosis":
    "The pathologist's overall interpretation of the cell sample.",
};

export function getParameterHelp(parameterId: string): string {
  return (
    PARAMETER_HELP[parameterId] ??
    "The laboratory value recorded for this measurement."
  );
}
