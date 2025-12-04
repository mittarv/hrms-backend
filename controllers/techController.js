const os = require('os');

// This is a simple get function which is used to check if the services are up and running
exports.healthCheck = async (req, res) => {
    var nUpTime = process.uptime();
    var strMessage = "";
    switch(true) {
        case (nUpTime > 0 && nUpTime < 3600): 
            strMessage = Math.floor(nUpTime) + ' secs';
            break;
        case (nUpTime < 86400 && nUpTime > 3600):
            strMessage = Math.floor(nUpTime/3600) + ' hours';
            break;
        default:
            strMessage = Math.floor(nUpTime/86400) + ' days';
    }
    console.log('Healthcheck Initiated. Duration:: ' + strMessage );
    const healthcheck = {
        upTime: strMessage,
    };
    try {
        res.send(healthcheck);
    } catch (error) {
        console.log('Healthcheck. Error Occurred. ' + error);
        res.status(503).send();
    }
};

// Get the instance on azure which is responding to this request. Also providing some meta-data which may be useful
exports.getDetailInfo = async (req, res) => {
    console.log('GetDetail Initiated by :: ' + req.hostname); 
    const getVersion = {
        client: req.hostname,
        host: os.hostname(),
        upTime: Math.floor(process.uptime()) + ' secs',
        nVersion: process.version,
    };

    try {
        res.send(getVersion);
    } catch (error) {
        console.log('GetVersionDetails. Error Occurred. ' + error);
        res.status(503).send();
    }
};