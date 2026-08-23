import { AppError } from '../middleware/AppError.js';

const transitions = Object.freeze({
  publish: Object.freeze({ from: ['DRAFT'], to: 'PENDING_REVIEW' }),
  pause: Object.freeze({ from: ['ACTIVE'], to: 'PAUSED' }),
  activate: Object.freeze({ from: ['PAUSED'], to: 'ACTIVE' }),
  close: Object.freeze({
    from: ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED'],
    to: 'CLOSED',
  }),
});

function invalidTransition(action, status) {
  return new AppError({
    statusCode: 409,
    code: 'INVALID_LISTING_TRANSITION',
    message: `A ${status.toLowerCase().replaceAll('_', ' ')} listing cannot ${action}.`,
  });
}

export const listingStateService = Object.freeze({
  assertEditable(status) {
    if (!['DRAFT', 'PAUSED'].includes(status)) {
      throw new AppError({
        statusCode: 409,
        code: 'LISTING_NOT_EDITABLE',
        message: 'This listing cannot be edited in its current state.',
      });
    }
  },

  transition(action, status) {
    const rule = transitions[action];
    if (!rule || !rule.from.includes(status)) {
      throw invalidTransition(action, status);
    }
    return rule.to;
  },
});
