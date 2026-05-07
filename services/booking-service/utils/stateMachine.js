const VALID_TRANSITIONS = {
  PENDING: ['ACCEPTED', 'ARRIVED', 'STARTED', 'CANCELLED'],
  ACCEPTED: ['ARRIVED', 'STARTED', 'CANCELLED'],
  ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['PAID'],
  PAID: [],
  CANCELLED: [],
};

const TERMINAL_STATES = ['PAID', 'CANCELLED'];

const isValidTransition = (currentStatus, newStatus) => {
  if (currentStatus === newStatus) return true;
  if (TERMINAL_STATES.includes(currentStatus)) {
    return false;
  }
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
};

const getStatePriority = (status) => {
  const priorities = {
    CANCELLED: -1,
    PENDING: 0,
    ACCEPTED: 1,
    ARRIVED: 2,
    STARTED: 3,
    COMPLETED: 4,
    PAID: 5,
  };
  return priorities[status] ?? 0;
};

const shouldApplyEvent = (currentStatus, newStatus) => {
  const currentPriority = getStatePriority(currentStatus);
  const newPriority = getStatePriority(newStatus);
  
  if (currentStatus === 'PAID' && newStatus === 'CANCELLED') {
    return false;
  }
  
  if (currentStatus === 'CANCELLED' && newStatus === 'PAID') {
    return false;
  }
  
  return newPriority >= currentPriority || isValidTransition(currentStatus, newStatus);
};

module.exports = {
  isValidTransition,
  shouldApplyEvent,
  TERMINAL_STATES,
  VALID_TRANSITIONS,
};
