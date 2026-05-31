// Question flow state machine. Drives the QUESTIONING engine state.
// Stub — wired up in Phase 1C.

export const Questionnaire = {
  answers: {},
  currentIndex: 0,

  reset() {
    this.answers = {};
    this.currentIndex = 0;
  },
};
