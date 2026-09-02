// Owner's Rep RFP scoring rubric — the committee's current version, transcribed
// from "Rubric Scoring Criteria.xlsx" (Drive: RFP Processes/Owner's Rep/Rubric/,
// tab "Scoring Criteria"). Edit this file directly if the wording, weights or
// guidance ever change again; nothing else needs to change to pick it up.
//
// `guidance` is the sheet's "What to look for" commentary. It is surfaced twice
// in the UI: inline under each slider in the scoring modal, and in the
// collapsible "Scoring Guide" section on /scoring — so every member has it in
// front of them while they score.
//
// NOTE on phase keys: the keys `Written` and `Interview` are persisted in the
// RFPScoring sheet and mapped to lock columns in lib/sheets.js — do not rename
// them. Only the display labels below are safe to change.
export const RFP_PHASES = {
  Written: {
    label: 'Written Proposal Evaluation',
    shortLabel: 'Written Proposal',
    criteria: [
      {
        key: 'score1',
        label: 'Conformance & Responsiveness to RFP',
        max: 10,
        guidance:
          "Proposal is complete, clear, and follows the RFP's instructions: reply sheet, questionnaire, references, non-collusion/code of ethics certification, and insurance procedure page are all included; firm can meet the insurance minimums in Exhibit A; proposal is organized and easy for the committee to evaluate."
      },
      {
        key: 'score2',
        label: 'Relevant Experience & Firm Qualifications',
        max: 15,
        guidance:
          "Firm's background and history serving as Owner's Representative on public school or comparable municipal construction projects of similar size, scope, and complexity to the Riverside School improvements; at least three references from Connecticut or New York school districts of similar size to Greenwich; experience with ADA improvements, cafeteria/building renovations, and phased, multi-project programs."
      },
      {
        key: 'score3',
        label: 'Assigned Personnel & Staffing Plan',
        max: 10,
        guidance:
          'Resume and qualifications of the specific individual(s) proposed to be on site; clear identification of the principal-in-charge and the extent of their involvement; ability to keep one qualified person assigned to the site as the RFP anticipates; depth of the firm and availability of backup coverage if key staff are unavailable.'
      },
      {
        key: 'score4',
        label: 'Construction Oversight & Technical Approach',
        max: 15,
        guidance:
          'Demonstrated approach to the scope of work in the RFP: attending OAC meetings and reporting to the Building Committee, monitoring contractor performance/cost/schedule, coordinating material testing, reviewing payment requisitions and change orders, monitoring conformance with contract documents, and establishing a final punch list; familiarity with the Connecticut State Office of School Construction Grants and Review process and other applicable regulatory agencies.'
      },
      {
        key: 'score5',
        label: 'Communication & School Operations Coordination',
        max: 5,
        guidance:
          'Concrete plan for facilitating communication between the contractor and the school to minimize disruption to school operations during construction; responsiveness and clarity demonstrated in the written proposal itself.'
      },
      {
        key: 'score6',
        label: 'Track Record & Past Performance',
        max: 5,
        guidance:
          "Firm's own reporting on how many recent projects exceeded budget and by what percentage; any litigation or arbitration with school boards in the past five years; quality and relevance of the references provided."
      }
    ]
  },
  Interview: {
    label: 'Interview Evaluation',
    shortLabel: 'Interview',
    criteria: [
      {
        key: 'score1',
        label: 'Communication & Presentation',
        max: 10,
        guidance:
          "Clarity and professionalism presenting the firm's approach; ability to answer committee questions directly and confidently."
      },
      {
        key: 'score2',
        label: 'Proactiveness & Problem-Solving',
        max: 10,
        guidance:
          'Concrete examples of identifying and resolving issues proactively on past projects; approach to managing cost overruns, schedule risk, and unexpected conditions.'
      },
      {
        key: 'score3',
        label: 'Technical Depth on Construction Oversight',
        max: 10,
        guidance:
          'Depth of knowledge shown in discussing OAC coordination, payment requisition review, monitoring conformance with contract documents, and the regulatory approval process.'
      },
      {
        key: 'score4',
        label: 'Responsiveness to Committee & Community Questions',
        max: 10,
        guidance:
          "Quality and directness of answers to committee-specific and community/stakeholder questions; overall fit with Riverside School's needs and the Building Committee's working style."
      }
    ]
  }
};

// Render order for anything that walks both phases (the Scoring Guide, admin
// toggles) so the UI never depends on object-key ordering.
export const RFP_PHASE_ORDER = ['Written', 'Interview'];

export function phaseTotal(phase) {
  return RFP_PHASES[phase].criteria.reduce((sum, c) => sum + c.max, 0);
}

export const RFP_RUBRIC_INTRO =
  "Definitions for each rubric category, tied to the RFP's evaluation factors and Owner's Representative scope of work.";

export const RFP_RUBRIC_NOTE =
  "Fee/cost is evaluated separately on the Fee Comparison tab, not folded into the 100-point technical score above — this keeps the technical review cost-blind, consistent with the RFP's sealed cost-envelope requirement.";
