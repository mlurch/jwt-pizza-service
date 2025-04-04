const { logging } = require("./config.js");

class Logger {
  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, "http", logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  factoryLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        order: JSON.stringify(resBody.order),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, "factory", logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  log(level, type, logData) {
    const labels = { component: logging.source, level: level, type: type };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return "error";
    if (statusCode >= 400) return "warn";
    return "info";
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    logData = JSON.stringify(logData);
    return logData.replace(
      /\\"password\\":\s*\\"[^"]*\\"/g,
      '\\"password\\": \\"*****\\"',
    );
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${logging.url}`, {
      method: "post",
      body: body,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${logging.userId}:${logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.error("Failed to send log to Grafana");
    });
  }
}

module.exports = new Logger();
