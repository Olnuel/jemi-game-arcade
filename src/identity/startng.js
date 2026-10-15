/**
 * Start.ng integration status.
 *
 * The repository and publicly available platform material inspected for this
 * build contain no supported session API, SDK, host contract, or styling schema.
 * Keep this seam unconfigured until an authoritative integration contract is
 * supplied; never infer a signed-in user from browser storage or a guessed global.
 */
export function readStartNgIdentity() {
  return {
    status: 'not-configured',
    user: null,
    reason: 'No verified Start.ng session provider is configured for this app.',
  };
}

export function mapStartNgStyle(_user, _centralStyle) {
  throw new Error('Start.ng styling cannot be mapped until its verified schema is available.');
}

