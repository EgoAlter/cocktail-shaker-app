// Cursor-based state machine for the Q&A flow.
//
// Cursor (integer index into a fixed array) rather than a stack because:
// - Questions are strictly linear — no branching in Phase 1
// - Reset is trivial: two fields back to zero/empty
// - A stack adds push/pop complexity with zero benefit for a linear flow

export const Questionnaire = {
  _questions: [],
  answers: {},
  currentIndex: 0,

  init(questions) {
    this._questions = questions;
    this.reset();
  },

  reset() {
    this.answers = {};
    this.currentIndex = 0;
  },

  current() {
    return this._questions[this.currentIndex] ?? null;
  },

  answer(value) {
    const q = this.current();
    if (!q) return;
    this.answers[q.id] = value;
    this.currentIndex++;
  },

  isComplete() {
    return this.currentIndex >= this._questions.length;
  },

  getAnswers() {
    return { ...this.answers };
  },
};
