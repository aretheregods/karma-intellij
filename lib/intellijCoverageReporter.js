var cli = require('./intellijCli.js')
  , intellijUtil = require('./intellijUtil.js')
  , fs = require('fs')
  , path = require('path')
  , EventEmitter = require('events').EventEmitter;

function findLcovInfoFile(coverageDir, callback) {
  var first = true;
  fs.readdir(coverageDir, function(err, files) {
    if (!err && files) {
      files.forEach(function(fileName) {
        var browserDir = path.join(coverageDir, fileName);
        fs.stat(browserDir, function(err, stats) {
          if (!err && stats && stats.isDirectory()) {
            var lcovFilePath = path.join(browserDir, "lcov.info");
            fs.stat(lcovFilePath, function(err, stats) {
              if (!err && stats && stats.isFile()) {
                if (first) {
                  first = false;
                  callback(lcovFilePath);
                }
              }
            });
          }
        });
      });
    }
  });
}

function findKarmaCoverageReporterConstructor(injector) {
  try {
    var someKarmaCoverageReporter = injector.get('reporter:coverage');
    return someKarmaCoverageReporter.constructor;
  }
  catch (ex) {
    return null;
  }
}

function IntellijCoverageReporter(injector, config, helper, logger) {
  var KarmaCoverageReporterConstructor = findKarmaCoverageReporterConstructor(injector);
  if (KarmaCoverageReporterConstructor != null) {
    init.call(this, KarmaCoverageReporterConstructor, config, helper, logger);
  }
  else {
    console.warn("IDE coverage reporter is disabled");
    this.adapters = [];
  }
  IntellijCoverageReporter.reportCoverageStartupStatus(true, KarmaCoverageReporterConstructor != null);
}

IntellijCoverageReporter.reportCoverageStartupStatus = function (coverageReporterSpecifiedInConfig, coverageReporterFound) {
  var event = {
    coverageReporterSpecifiedInConfig : coverageReporterSpecifiedInConfig
  };
  if (coverageReporterFound == null) {
    coverageReporterFound = true;
  }
  event.coverageReporterFound = coverageReporterFound;
  intellijUtil.sendIntellijEvent('coverageStartupStatus', event);
};

function init(KarmaCoverageReporter, config, helper, logger) {
  var rootConfig = {
    coverageReporter : {
      type : 'lcovonly',
      dir : cli.getCoverageTempDirPath()
    },
    basePath : config.basePath
  };

  var emitter = new EventEmitter();
  KarmaCoverageReporter.call(this, rootConfig, emitter, helper, logger);

  var currentBrowser = null;

  var superOnRunStart = this.onRunStart.bind(this);
  this.onRunStart = function(browsers) {
    currentBrowser = findBestBrowser(browsers);
    var browserArray = [];
    if (currentBrowser) {
      browserArray = [currentBrowser];
    }
    superOnRunStart(browserArray);
  };

  var superOnBrowserComplete = this.onBrowserComplete.bind(this);
  this.onBrowserComplete = function(browser, result) {
    if (browser === currentBrowser) {
      superOnBrowserComplete.apply(this, arguments);
    }
  };

  var superOnSpecComplete = this.onSpecComplete.bind(this);
  this.onSpecComplete = function(browser/*, result*/) {
    if (browser === currentBrowser) {
      superOnSpecComplete.apply(this, arguments);
    }
  };

  var superOnRunComplete = this.onRunComplete.bind(this);
  this.onRunComplete = function (browsers/*, results*/) {
    var found = currentBrowser && containsBrowser(browsers, currentBrowser);
    if (found) {
      superOnRunComplete([currentBrowser]);
      setTimeout(function() {
        emitter.emit('exit', function() {
          findLcovInfoFile(rootConfig.coverageReporter.dir, function(lcovFilePath) {
            intellijUtil.sendIntellijEvent('coverageFinished', lcovFilePath);
          });
        });
      }, 1000);
    }
  };
}

function findBestBrowser(browsers) {
  if (browsers.length <= 1) {
    return getAnyBrowser(browsers);
  }
  var browserNamesInPreferredOrder = ['Chrome ', 'Firefox ', 'Safari ', 'Opera '];
  var len = browserNamesInPreferredOrder.length;
  for (var i = 0; i < len; i++) {
    var browser = findBrowserByName(browsers, browserNamesInPreferredOrder[i]);
    if (browser) {
      return browser;
    }
  }
  return getAnyBrowser(browsers);
}

function getAnyBrowser(browsers) {
  var result = null;
  browsers.forEach(function (browser) {
    if (result == null) {
      result = browser;
    }
  });
  return result;
}

function containsBrowser(browsers, targetBrowser) {
  var result = false;
  browsers.forEach(function (browser) {
    if (browser === targetBrowser) {
      result = true;
    }
  });
  return result;
}

function findBrowserByName(browsers, browserNamePrefix) {
  var result = null;
  browsers.forEach(function (browser) {
    var browserName = browser.name;
    if (result == null && intellijUtil.isString(browserName) && browserName.indexOf(browserNamePrefix) === 0) {
      result = browser;
    }
  });
  return result;
}

IntellijCoverageReporter.$inject = ['injector', 'config', 'helper', 'logger'];
IntellijCoverageReporter.reporterName = 'intellijCoverage_33e284dac2b015a9da50d767dc3fa58a';

module.exports = IntellijCoverageReporter;
