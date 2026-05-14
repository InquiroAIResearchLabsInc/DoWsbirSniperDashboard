class StopRule extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'StopRule';
    this.context = context;
    this.ts = new Date().toISOString();
  }
}

function assertOrStop(condition, message, context = {}) {
  if (!condition) throw new StopRule(message, context);
}

module.exports = { StopRule, assertOrStop };
