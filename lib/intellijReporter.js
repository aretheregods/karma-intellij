var ideCfg = require("./ideConfig.js")
  , BaseReporter = ideCfg.requireKarmaModule('lib/reporters/Base.js')
  , escapeUtil = require('./escapeUtil.js');

var util = require('util');

var Tree = require('./tree.js');

function getOrCreateBrowserNode(tree, browser) {
  var configFileNode = tree.configFileNode;
  var browserNode = configFileNode.lookupMap[browser.id];
  if (!browserNode) {
    browserNode = configFileNode.addChild(browser.name, true, 'browser', null);
    configFileNode.lookupMap[browser.id] = browserNode;
    browserNode.writeStartMessage();
  }
  return browserNode;
}

function addBrowserErrorNode(tree, browser, error) {
  var browserNode = getOrCreateBrowserNode(tree, browser);
  var browserErrorNode = browserNode.addChild('Error', false, 'browserError', null);
  browserErrorNode.writeStartMessage();
  browserErrorNode.setStatus(3, null, error);
  browserErrorNode.writeFinishMessage();
}

function getOrCreateLowerSuiteNode(browserNode, suiteNames) {
  var node = browserNode
    , len = suiteNames.length;
  for (var i = 0; i < len; i++) {
    var suiteName = suiteNames[i];
    if (suiteName == null) {
      throw Error("Suite name is null!");
    }
    var nextNode = node.lookupMap[suiteName];
    if (!nextNode) {
      var locationHint = escapeUtil.joinList(suiteNames, 0, i + 1, ',');
      nextNode = node.addChild(suiteName, true, 'suite', locationHint);
      node.lookupMap[suiteName] = nextNode;
      nextNode.writeStartMessage();
    }
    node = nextNode;
  }
  return node;
}

function createSpecNode(suiteNode, suiteNames, specName) {
  var specNode = suiteNode.lookupMap[specName];
  if (specNode) {
    throw Error("Spec node is already created");
  }
  var names = suiteNames.slice();
  names.push(specName);
  var locationHint = escapeUtil.joinList(names, 0, names.length, ',');
  specNode = suiteNode.addChild(specName, false, 'spec', locationHint);
  specNode.writeStartMessage();
  return specNode;
}

function IntellijReporter(formatError) {
  BaseReporter.call(this, formatError, false);
  this.adapters = [];

  var that = this;
  var write = function (msg) {
    that.adapters.forEach(function(adapter) {
      adapter(msg);
    });
  };

  var tree;

  this.onRunStart = function (browsers) {
    tree = new Tree(ideCfg.getConfigFile(), write);
  };

  this.onBrowserError = function (browser, error) {
    addBrowserErrorNode(tree, browser, error);
  };

  this.onBrowserDump = function (browser, dump) {
    if (dump.length === 1) {
      dump = dump[0];
    }

    dump = util.inspect(dump, false, undefined, true);
    write(dump + '\n');
  };

  this.onSpecComplete = function (browser, result) {
    var browserNode = getOrCreateBrowserNode(tree, browser);
    var suiteNode = getOrCreateLowerSuiteNode(browserNode, result.suite);
    var specNode = createSpecNode(suiteNode, result.suite, result.description);
    var status;
    if (result.success) {
      status = 0;
    }
    else if (result.skipped) {
      status = 1;
    }
    else {
      status = 2;
    }
    var failureMsg = '';
    result.log.forEach(function (log) {
      failureMsg += formatError(log, '\t');
    });
    specNode.setStatus(status, result.time, failureMsg);
    specNode.writeFinishMessage();
  };

  this.onRunComplete = function (browsers, results) {
    tree.configFileNode.finishIfStarted();
    tree = null;
  };
}

IntellijReporter.$inject = ['formatError'];

module.exports = {
  'reporter:intellij' : ['type', IntellijReporter]
};
