// Owner's Rep RFP scoring rubric. Mirrors the categories/weights used for the
// Architect RFP process (see "RVS RFP-Architect-Rubric Scoring Sheet" in Drive) —
// edit this file directly if the committee finalizes different wording or weights;
// nothing else needs to change to pick it up. Note: "Design Approach & Creativity"
// (Written #3) was an architect-specific criterion carried over as a placeholder —
// probably worth renaming for an Owner's Rep context.
export const RFP_PHASES = {
  Written: {
    label: 'Written Proposal',
    criteria: [
      { key: 'score1', label: 'Relevant Experience & Team Strength', max: 15 },
      { key: 'score2', label: 'Technical Expertise', max: 15 },
      { key: 'score3', label: 'Design Approach & Creativity', max: 10 },
      { key: 'score4', label: 'Project Approach & Proactiveness', max: 10 },
      { key: 'score5', label: 'Political & Community Navigation', max: 5 },
      { key: 'score6', label: 'Clarity, Responsiveness, and Overall Quality', max: 5 }
    ]
  },
  Interview: {
    label: 'Interview',
    criteria: [
      { key: 'score1', label: 'Communication', max: 10 },
      { key: 'score2', label: 'Creativity', max: 10 },
      { key: 'score3', label: 'Proactiveness & Problem Solving', max: 10 },
      { key: 'score4', label: 'Responsiveness to Community and Stakeholder', max: 10 }
    ]
  }
};
