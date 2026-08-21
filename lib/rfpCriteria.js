// Owner's Rep RFP scoring rubric, finalized by the committee (see "RFP-Owner's
// Rep-Rubric Scoring Sheet (DRAFT)" in Drive) — edit this file directly if the
// wording or weights ever change again; nothing else needs to change to pick it up.
export const RFP_PHASES = {
  Written: {
    label: 'Written Proposal',
    criteria: [
      { key: 'score1', label: 'Relevant CT School Experience & Team Strength', max: 15 },
      { key: 'score2', label: 'State Reimbursement (DAS/OGA) & Project Controls Expertise', max: 15 },
      { key: 'score3', label: 'Approach to Budget/Schedule/Risk Management', max: 10 },
      { key: 'score4', label: 'Staffing Plan/Availability & Proactiveness', max: 10 },
      { key: 'score5', label: 'Political & Community Navigation', max: 5 },
      { key: 'score6', label: 'Clarity, Responsiveness & Overall Quality', max: 5 }
    ]
  },
  Interview: {
    label: 'Interview',
    criteria: [
      { key: 'score1', label: 'Communication', max: 10 },
      { key: 'score2', label: 'Problem-Solving & Practical Judgment', max: 10 },
      { key: 'score3', label: 'Proactiveness, Ownership & Follow-Through', max: 10 },
      { key: 'score4', label: 'Responsiveness to Community & Stakeholders', max: 10 }
    ]
  }
};
