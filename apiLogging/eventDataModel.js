exports.timeStampLogData = ({
    methodName,
    requestType,
    userId,
    message,
    platform,
}) => {
    try {
        return {
            methodName,
            requestType,
            userId,
            message,
            platform,
            timeStamp: Date.now(),
        };
    } catch (error) {
        console.log(error);
        return {}
    }

}