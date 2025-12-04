// This function is used to convert error object to data object
// The data object is then sent to the event hub
// The event hub is used to store the logs
// The logs are used to monitor the application
// error => error object
// message => error message
// statusCode => status code of the error
// stack => error stack
// methodName => method name where the error occured
// requestType => type of request if it is post, get, put or delete,patch etc
// platform => platform where the error occured, like coreweb, mittarv, flutter,backend etc
// userId => user id of the user who is using the application
// errorOccuredAt => time when the error occured
const convertErrorToData = ({
  error,
  message,
  statusCode,
  stack,
  methodName,
  requestType,
  platform,
  userId,
  errorOccuredAt,
}) => {
  const eventData = {
    error,
    message,
    statusCode,
    stack,
    methodName,
    requestType,
    platform,
    userId,
    errorOccuredAt: errorOccuredAt || new Date().toISOString(),
  };
  return eventData;
};
module.exports = convertErrorToData;
