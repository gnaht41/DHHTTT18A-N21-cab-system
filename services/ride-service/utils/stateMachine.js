const VALID_TRANSITIONS = {
  PENDING: ['DRIVER_ASSIGNED', 'ACCEPTED', 'CANCELLED'],
  DRIVER_ASSIGNED: ['ACCEPTED', 'ARRIVED', 'CANCELLED'],
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
    DRIVER_ASSIGNED: 1,
    ACCEPTED: 2,
    ARRIVED: 3,
    STARTED: 4,
    COMPLETED: 5,
    PAID: 6,
  };
  return priorities[status] ?? 0;
};

const shouldApplyEvent = (currentStatus, newStatus) => {
  const currentPriority = getStatePriority(currentStatus);
  const newPriority = getStatePriority(newStatus);
  
  // PAID cannot become CANCELLED
  if (currentStatus === 'PAID' && newStatus === 'CANCELLED') {
    return false;
  }
  
  // CANCELLED cannot become PAID
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
