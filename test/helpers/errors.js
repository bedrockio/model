expect.extend({
  toHaveMessage(error, message) {
    const pass = errorHasMessage(error, message);
    return {
      message: () => {
        const { printReceived, printExpected } = this.utils;
        const expected = printExpected(message);
        const messages = getErrorMessages(error);
        const received = printReceived(messages.join(', '));
        return `Expected: ${expected} \nMessages: ${received}`;
      },
      pass,
    };
  },
});

function errorHasMessage(error, message) {
  if (error.message === message) {
    return true;
  } else {
    return error.details?.some((err) => {
      return errorHasMessage(err, message);
    });
  }
}

function getErrorMessages(error) {
  if (error.details) {
    return error.details.flatMap(getErrorMessages);
  } else {
    return [error.message];
  }
}
