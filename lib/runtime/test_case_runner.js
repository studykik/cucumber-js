'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _helpers = require('./helpers');

var _attachment_manager = require('./attachment_manager');

var _attachment_manager2 = _interopRequireDefault(_attachment_manager);

var _status = require('../status');

var _status2 = _interopRequireDefault(_status);

var _step_runner = require('./step_runner');

var _step_runner2 = _interopRequireDefault(_step_runner);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var TestCaseRunner = function () {
  function TestCaseRunner(_ref) {
    var _this = this;

    var eventBroadcaster = _ref.eventBroadcaster,
        skip = _ref.skip,
        testCase = _ref.testCase,
        supportCodeLibrary = _ref.supportCodeLibrary,
        worldParameters = _ref.worldParameters;
    (0, _classCallCheck3.default)(this, TestCaseRunner);

    var attachmentManager = new _attachment_manager2.default(function (_ref2) {
      var data = _ref2.data,
          media = _ref2.media;

      _this.emit('test-step-attachment', {
        index: _this.testStepIndex,
        data: data,
        media: media
      });
    });
    this.eventBroadcaster = eventBroadcaster;
    this.skip = skip;
    this.testCase = testCase;
    this.supportCodeLibrary = supportCodeLibrary;
    this.world = new supportCodeLibrary.World({
      attach: attachmentManager.create.bind(attachmentManager),
      parameters: worldParameters
    });
    this.beforeHookDefinitions = this.getBeforeHookDefinitions();
    this.afterHookDefinitions = this.getAfterHookDefinitions();
    this.testStepIndex = 0;
    this.result = {
      duration: 0,
      status: this.skip ? _status2.default.SKIPPED : _status2.default.PASSED
    };
    this.testCaseSourceLocation = {
      uri: this.testCase.uri,
      line: this.testCase.pickle.locations[0].line
    };
  }

  (0, _createClass3.default)(TestCaseRunner, [{
    key: 'emit',
    value: function emit(name, data) {
      var eventData = (0, _extends3.default)({}, data);
      if (_lodash2.default.startsWith(name, 'test-case')) {
        eventData.sourceLocation = this.testCaseSourceLocation;
      } else {
        eventData.testCase = { sourceLocation: this.testCaseSourceLocation };
      }
      this.eventBroadcaster.emit(name, eventData);
    }
  }, {
    key: 'emitPrepared',
    value: function emitPrepared() {
      var _this2 = this;

      var steps = [];
      this.beforeHookDefinitions.forEach(function (definition) {
        var actionLocation = { uri: definition.uri, line: definition.line };
        steps.push({ actionLocation: actionLocation });
      });
      this.testCase.pickle.steps.forEach(function (step) {
        var actionLocations = _this2.getStepDefinitions(step).map(function (definition) {
          return { uri: definition.uri, line: definition.line };
        });
        var sourceLocation = {
          uri: _this2.testCase.uri,
          line: _lodash2.default.last(step.locations).line
        };
        var data = { sourceLocation: sourceLocation };
        if (actionLocations.length === 1) {
          data.actionLocation = actionLocations[0];
        }
        steps.push(data);
      });
      this.afterHookDefinitions.forEach(function (definition) {
        var actionLocation = { uri: definition.uri, line: definition.line };
        steps.push({ actionLocation: actionLocation });
      });
      this.emit('test-case-prepared', { steps: steps });
    }
  }, {
    key: 'getAfterHookDefinitions',
    value: function getAfterHookDefinitions() {
      var _this3 = this;

      return this.supportCodeLibrary.afterTestCaseHookDefinitions.filter(function (hookDefinition) {
        return hookDefinition.appliesToTestCase(_this3.testCase);
      });
    }
  }, {
    key: 'getBeforeHookDefinitions',
    value: function getBeforeHookDefinitions() {
      var _this4 = this;

      return this.supportCodeLibrary.beforeTestCaseHookDefinitions.filter(function (hookDefinition) {
        return hookDefinition.appliesToTestCase(_this4.testCase);
      });
    }
  }, {
    key: 'getStepDefinitions',
    value: function getStepDefinitions(step) {
      var _this5 = this;

      return this.supportCodeLibrary.stepDefinitions.filter(function (stepDefinition) {
        return stepDefinition.matchesStepName({
          stepName: step.text,
          parameterTypeRegistry: _this5.supportCodeLibrary.parameterTypeRegistry
        });
      });
    }
  }, {
    key: 'invokeStep',
    value: function invokeStep(step, stepDefinition, hookParameter) {
      return _step_runner2.default.run({
        defaultTimeout: this.supportCodeLibrary.defaultTimeout,
        hookParameter: hookParameter,
        parameterTypeRegistry: this.supportCodeLibrary.parameterTypeRegistry,
        step: step,
        stepDefinition: stepDefinition,
        world: this.world
      });
    }
  }, {
    key: 'isSkippingSteps',
    value: function isSkippingSteps() {
      return this.result.status !== _status2.default.PASSED;
    }
  }, {
    key: 'shouldUpdateStatus',
    value: function shouldUpdateStatus(testStepResult) {
      switch (testStepResult.status) {
        case _status2.default.FAILED:
        case _status2.default.AMBIGUOUS:
          return this.result.status !== _status2.default.FAILED || this.result.status !== _status2.default.AMBIGUOUS;
        default:
          return this.result.status === _status2.default.PASSED || this.result.status === _status2.default.SKIPPED;
      }
    }
  }, {
    key: 'aroundTestStep',
    value: function () {
      var _ref3 = (0, _bluebird.coroutine)(function* (runStepFn) {
        this.emit('test-step-started', { index: this.testStepIndex });
        var testStepResult = yield runStepFn();
        if (testStepResult.duration) {
          this.result.duration += testStepResult.duration;
        }
        if (this.shouldUpdateStatus(testStepResult)) {
          this.result.status = testStepResult.status;
        }
        this.emit('test-step-finished', {
          index: this.testStepIndex,
          result: testStepResult
        });
        this.testStepIndex += 1;
      });

      function aroundTestStep(_x) {
        return _ref3.apply(this, arguments);
      }

      return aroundTestStep;
    }()
  }, {
    key: 'run',
    value: function () {
      var _ref4 = (0, _bluebird.coroutine)(function* () {
        this.emitPrepared();
        this.emit('test-case-started', {});
        yield this.runHooks(this.beforeHookDefinitions, {
          sourceLocation: this.testCaseSourceLocation,
          pickle: this.testCase.pickle
        });
        yield this.runSteps();
        yield this.runHooks(this.afterHookDefinitions, {
          sourceLocation: this.testCaseSourceLocation,
          pickle: this.testCase.pickle,
          result: this.result
        });
        this.emit('test-case-finished', { result: this.result });
        return this.result;
      });

      function run() {
        return _ref4.apply(this, arguments);
      }

      return run;
    }()
  }, {
    key: 'runHook',
    value: function () {
      var _ref5 = (0, _bluebird.coroutine)(function* (hookDefinition, hookParameter) {
        if (this.skip) {
          return { status: _status2.default.SKIPPED };
        } else {
          return yield this.invokeStep(null, hookDefinition, hookParameter);
        }
      });

      function runHook(_x2, _x3) {
        return _ref5.apply(this, arguments);
      }

      return runHook;
    }()
  }, {
    key: 'runHooks',
    value: function () {
      var _ref6 = (0, _bluebird.coroutine)(function* (hookDefinitions, hookParameter) {
        var _this6 = this;

        yield _bluebird2.default.each(hookDefinitions, function () {
          var _ref7 = (0, _bluebird.coroutine)(function* (hookDefinition) {
            yield _this6.aroundTestStep(function () {
              return _this6.runHook(hookDefinition, hookParameter);
            });
          });

          return function (_x6) {
            return _ref7.apply(this, arguments);
          };
        }());
      });

      function runHooks(_x4, _x5) {
        return _ref6.apply(this, arguments);
      }

      return runHooks;
    }()
  }, {
    key: 'runStep',
    value: function () {
      var _ref8 = (0, _bluebird.coroutine)(function* (step) {
        var stepDefinitions = this.getStepDefinitions(step);
        if (stepDefinitions.length === 0) {
          return { status: _status2.default.UNDEFINED };
        } else if (stepDefinitions.length > 1) {
          return {
            exception: (0, _helpers.getAmbiguousStepException)(stepDefinitions),
            status: _status2.default.AMBIGUOUS
          };
        } else if (this.isSkippingSteps()) {
          return { status: _status2.default.SKIPPED };
        } else {
          return yield this.invokeStep(step, stepDefinitions[0]);
        }
      });

      function runStep(_x7) {
        return _ref8.apply(this, arguments);
      }

      return runStep;
    }()
  }, {
    key: 'runSteps',
    value: function () {
      var _ref9 = (0, _bluebird.coroutine)(function* () {
        var _this7 = this;

        yield _bluebird2.default.each(this.testCase.pickle.steps, function () {
          var _ref10 = (0, _bluebird.coroutine)(function* (step) {
            yield _this7.aroundTestStep(function () {
              return _this7.runStep(step);
            });
          });

          return function (_x8) {
            return _ref10.apply(this, arguments);
          };
        }());
      });

      function runSteps() {
        return _ref9.apply(this, arguments);
      }

      return runSteps;
    }()
  }]);
  return TestCaseRunner;
}();

exports.default = TestCaseRunner;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydW50aW1lL3Rlc3RfY2FzZV9ydW5uZXIuanMiXSwibmFtZXMiOlsiVGVzdENhc2VSdW5uZXIiLCJldmVudEJyb2FkY2FzdGVyIiwic2tpcCIsInRlc3RDYXNlIiwic3VwcG9ydENvZGVMaWJyYXJ5Iiwid29ybGRQYXJhbWV0ZXJzIiwiYXR0YWNobWVudE1hbmFnZXIiLCJkYXRhIiwibWVkaWEiLCJlbWl0IiwiaW5kZXgiLCJ0ZXN0U3RlcEluZGV4Iiwid29ybGQiLCJXb3JsZCIsImF0dGFjaCIsImNyZWF0ZSIsInBhcmFtZXRlcnMiLCJiZWZvcmVIb29rRGVmaW5pdGlvbnMiLCJnZXRCZWZvcmVIb29rRGVmaW5pdGlvbnMiLCJhZnRlckhvb2tEZWZpbml0aW9ucyIsImdldEFmdGVySG9va0RlZmluaXRpb25zIiwicmVzdWx0IiwiZHVyYXRpb24iLCJzdGF0dXMiLCJTS0lQUEVEIiwiUEFTU0VEIiwidGVzdENhc2VTb3VyY2VMb2NhdGlvbiIsInVyaSIsImxpbmUiLCJwaWNrbGUiLCJsb2NhdGlvbnMiLCJuYW1lIiwiZXZlbnREYXRhIiwic3RhcnRzV2l0aCIsInNvdXJjZUxvY2F0aW9uIiwic3RlcHMiLCJmb3JFYWNoIiwiYWN0aW9uTG9jYXRpb24iLCJkZWZpbml0aW9uIiwicHVzaCIsImFjdGlvbkxvY2F0aW9ucyIsImdldFN0ZXBEZWZpbml0aW9ucyIsInN0ZXAiLCJtYXAiLCJsYXN0IiwibGVuZ3RoIiwiYWZ0ZXJUZXN0Q2FzZUhvb2tEZWZpbml0aW9ucyIsImZpbHRlciIsImhvb2tEZWZpbml0aW9uIiwiYXBwbGllc1RvVGVzdENhc2UiLCJiZWZvcmVUZXN0Q2FzZUhvb2tEZWZpbml0aW9ucyIsInN0ZXBEZWZpbml0aW9ucyIsInN0ZXBEZWZpbml0aW9uIiwibWF0Y2hlc1N0ZXBOYW1lIiwic3RlcE5hbWUiLCJ0ZXh0IiwicGFyYW1ldGVyVHlwZVJlZ2lzdHJ5IiwiaG9va1BhcmFtZXRlciIsInJ1biIsImRlZmF1bHRUaW1lb3V0IiwidGVzdFN0ZXBSZXN1bHQiLCJGQUlMRUQiLCJBTUJJR1VPVVMiLCJydW5TdGVwRm4iLCJzaG91bGRVcGRhdGVTdGF0dXMiLCJlbWl0UHJlcGFyZWQiLCJydW5Ib29rcyIsInJ1blN0ZXBzIiwiaW52b2tlU3RlcCIsImhvb2tEZWZpbml0aW9ucyIsImVhY2giLCJhcm91bmRUZXN0U3RlcCIsInJ1bkhvb2siLCJVTkRFRklORUQiLCJleGNlcHRpb24iLCJpc1NraXBwaW5nU3RlcHMiLCJydW5TdGVwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7QUFDQTs7QUFDQTs7OztBQUVBOzs7O0FBQ0E7Ozs7OztJQUVxQkEsYztBQUNuQixnQ0FNRztBQUFBOztBQUFBLFFBTERDLGdCQUtDLFFBTERBLGdCQUtDO0FBQUEsUUFKREMsSUFJQyxRQUpEQSxJQUlDO0FBQUEsUUFIREMsUUFHQyxRQUhEQSxRQUdDO0FBQUEsUUFGREMsa0JBRUMsUUFGREEsa0JBRUM7QUFBQSxRQUREQyxlQUNDLFFBRERBLGVBQ0M7QUFBQTs7QUFDRCxRQUFNQyxvQkFBb0IsaUNBQXNCLGlCQUFxQjtBQUFBLFVBQWxCQyxJQUFrQixTQUFsQkEsSUFBa0I7QUFBQSxVQUFaQyxLQUFZLFNBQVpBLEtBQVk7O0FBQ25FLFlBQUtDLElBQUwsQ0FBVSxzQkFBVixFQUFrQztBQUNoQ0MsZUFBTyxNQUFLQyxhQURvQjtBQUVoQ0osa0JBRmdDO0FBR2hDQztBQUhnQyxPQUFsQztBQUtELEtBTnlCLENBQTFCO0FBT0EsU0FBS1AsZ0JBQUwsR0FBd0JBLGdCQUF4QjtBQUNBLFNBQUtDLElBQUwsR0FBWUEsSUFBWjtBQUNBLFNBQUtDLFFBQUwsR0FBZ0JBLFFBQWhCO0FBQ0EsU0FBS0Msa0JBQUwsR0FBMEJBLGtCQUExQjtBQUNBLFNBQUtRLEtBQUwsR0FBYSxJQUFJUixtQkFBbUJTLEtBQXZCLENBQTZCO0FBQ3hDQyxjQUFVUixrQkFBa0JTLE1BQTVCLE1BQVVULGlCQUFWLENBRHdDO0FBRXhDVSxrQkFBWVg7QUFG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Ozs7Ozs7Ozs7Ozt3REFFZ0I7QUFBQTs7QUFDZixjQUFNLG1CQUFRbUIsSUFBUixDQUFhLEtBQUtuRSxRQUFMLENBQWMwQixNQUFkLENBQXFCTSxLQUFsQztBQUFBLGdEQUF5QyxXQUFNTyxJQUFOLEVBQWM7QUFDM0Qsa0JBQU0sT0FBSzZCLGNBQUwsQ0FBb0IsWUFBTTtBQUM5QixxQkFBTyxPQUFLSyxPQUFMLENBQWFsQyxJQUFiLENBQVA7QUFDRCxhQUZLLENBQU47QUFHRCxXQUpLOztBQUFBO0FBQUE7QUFBQTtBQUFBLFlBQU47QUFLRCxPOzs7Ozs7Ozs7Ozs7a0JBeE1rQjFDLGMiLCJmaWxlIjoidGVzdF9jYXNlX3J1bm5lci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBfIGZyb20gJ2xvZGFzaCdcbmltcG9ydCB7IGdldEFtYmlndW91c1N0ZXBFeGNlcHRpb24gfSBmcm9tICcuL2hlbHBlcnMnXG5pbXBvcnQgQXR0YWNobWVudE1hbmFnZXIgZnJvbSAnLi9hdHRhY2htZW50X21hbmFnZXInXG5pbXBvcnQgUHJvbWlzZSBmcm9tICdibHVlYmlyZCdcbmltcG9ydCBTdGF0dXMgZnJvbSAnLi4vc3RhdHVzJ1xuaW1wb3J0IFN0ZXBSdW5uZXIgZnJvbSAnLi9zdGVwX3J1bm5lcidcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGVzdENhc2VSdW5uZXIge1xuICBjb25zdHJ1Y3Rvcih7XG4gICAgZXZlbnRCcm9hZGNhc3RlcixcbiAgICBza2lwLFxuICAgIHRlc3RDYXNlLFxuICAgIHN1cHBvcnRDb2RlTGlicmFyeSxcbiAgICB3b3JsZFBhcmFtZXRlcnNcbiAgfSkge1xuICAgIGNvbnN0IGF0dGFjaG1lbnRNYW5hZ2VyID0gbmV3IEF0dGFjaG1lbnRNYW5hZ2VyKCh7IGRhdGEsIG1lZGlhIH0pID0+IHtcbiAgICAgIHRoaXMuZW1pdCgndGVzdC1zdGVwLWF0dGFjaG1lbnQnLCB7XG4gICAgICAgIGluZGV4OiB0aGlzLnRlc3RTdGVwSW5kZXgsXG4gICAgICAgIGRhdGEsXG4gICAgICAgIG1lZGlhXG4gICAgICB9KVxuICAgIH0pXG4gICAgdGhpcy5ldmVudEJyb2FkY2FzdGVyID0gZXZlbnRCcm9hZGNhc3RlclxuICAgIHRoaXMuc2tpcCA9IHNraXBcbiAgICB0aGlzLnRlc3RDYXNlID0gdGVzdENhc2VcbiAgICB0aGlzLnN1cHBvcnRDb2RlTGlicmFyeSA9IHN1cHBvcnRDb2RlTGlicmFyeVxuICAgIHRoaXMud29ybGQgPSBuZXcgc3VwcG9ydENvZGVMaWJyYXJ5LldvcmxkKHtcbiAgICAgIGF0dGFjaDogOjphdHRhY2htZW50TWFuYWdlci5jcmVhdGUsXG4gICAgICBwYXJhbWV0ZXJzOiB3b3JsZFBhcmFtZXRlcnNcbiAgICB9KVxuICAgIHRoaXMuYmVmb3JlSG9va0RlZmluaXRpb25zID0gdGhpcy5nZXRCZWZvcmVIb29rRGVmaW5pdGlvbnMoKVxuICAgIHRoaXMuYWZ0ZXJIb29rRGVmaW5pdGlvbnMgPSB0aGlzLmdldEFmdGVySG9va0RlZmluaXRpb25zKClcbiAgICB0aGlzLnRlc3RTdGVwSW5kZXggPSAwXG4gICAgdGhpcy5yZXN1bHQgPSB7XG4gICAgICBkdXJhdGlvbjogMCxcbiAgICAgIHN0YXR1czogdGhpcy5za2lwID8gU3RhdHVzLlNLSVBQRUQgOiBTdGF0dXMuUEFTU0VEXG4gICAgfVxuICAgIHRoaXMudGVzdENhc2VTb3VyY2VMb2NhdGlvbiA9IHtcbiAgICAgIHVyaTogdGhpcy50ZXN0Q2FzZS51cmksXG4gICAgICBsaW5lOiB0aGlzLnRlc3RDYXNlLnBpY2tsZS5sb2NhdGlvbnNbMF0ubGluZVxuICAgIH1cbiAgfVxuXG4gIGVtaXQobmFtZSwgZGF0YSkge1xuICAgIGxldCBldmVudERhdGEgPSB7IC4uLmRhdGEgfVxuICAgIGlmIChfLnN0YXJ0c1dpdGgobmFtZSwgJ3Rlc3QtY2FzZScpKSB7XG4gICAgICBldmVudERhdGEuc291cmNlTG9jYXRpb24gPSB0aGlzLnRlc3RDYXNlU291cmNlTG9jYXRpb25cbiAgICB9IGVsc2Uge1xuICAgICAgZXZlbnREYXRhLnRlc3RDYXNlID0geyBzb3VyY2VMb2NhdGlvbjogdGhpcy50ZXN0Q2FzZVNvdXJjZUxvY2F0aW9uIH1cbiAgICB9XG4gICAgdGhpcy5ldmVudEJyb2FkY2FzdGVyLmVtaXQobmFtZSwgZXZlbnREYXRhKVxuICB9XG5cbiAgZW1pdFByZXBhcmVkKCkge1xuICAgIGNvbnN0IHN0ZXBzID0gW11cbiAgICB0aGlzLmJlZm9yZUhvb2tEZWZpbml0aW9ucy5mb3JFYWNoKGRlZmluaXRpb24gPT4ge1xuICAgICAgY29uc3QgYWN0aW9uTG9jYXRpb24gPSB7IHVyaTogZGVmaW5pdGlvbi51cmksIGxpbmU6IGRlZmluaXRpb24ubGluZSB9XG4gICAgICBzdGVwcy5wdXNoKHsgYWN0aW9uTG9jYXRpb24gfSlcbiAgICB9KVxuICAgIHRoaXMudGVzdENhc2UucGlja2xlLnN0ZXBzLmZvckVhY2goc3RlcCA9PiB7XG4gICAgICBjb25zdCBhY3Rpb25Mb2NhdGlvbnMgPSB0aGlzLmdldFN0ZXBEZWZpbml0aW9ucyhzdGVwKS5tYXAoZGVmaW5pdGlvbiA9PiB7XG4gICAgICAgIHJldHVybiB7IHVyaTogZGVmaW5pdGlvbi51cmksIGxpbmU6IGRlZmluaXRpb24ubGluZSB9XG4gICAgICB9KVxuICAgICAgY29uc3Qgc291cmNlTG9jYXRpb24gPSB7XG4gICAgICAgIHVyaTogdGhpcy50ZXN0Q2FzZS51cmksXG4gICAgICAgIGxpbmU6IF8ubGFzdChzdGVwLmxvY2F0aW9ucykubGluZVxuICAgICAgfVxuICAgICAgY29uc3QgZGF0YSA9IHsgc291cmNlTG9jYXRpb24gfVxuICAgICAgaWYgKGFjdGlvbkxvY2F0aW9ucy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgZGF0YS5hY3Rpb25Mb2NhdGlvbiA9IGFjdGlvbkxvY2F0aW9uc1swXVxuICAgICAgfVxuICAgICAgc3RlcHMucHVzaChkYXRhKVxuICAgIH0pXG4gICAgdGhpcy5hZnRlckhvb2tEZWZpbml0aW9ucy5mb3JFYWNoKGRlZmluaXRpb24gPT4ge1xuICAgICAgY29uc3QgYWN0aW9uTG9jYXRpb24gPSB7IHVyaTogZGVmaW5pdGlvbi51cmksIGxpbmU6IGRlZmluaXRpb24ubGluZSB9XG4gICAgICBzdGVwcy5wdXNoKHsgYWN0aW9uTG9jYXRpb24gfSlcbiAgICB9KVxuICAgIHRoaXMuZW1pdCgndGVzdC1jYXNlLXByZXBhcmVkJywgeyBzdGVwcyB9KVxuICB9XG5cbiAgZ2V0QWZ0ZXJIb29rRGVmaW5pdGlvbnMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3VwcG9ydENvZGVMaWJyYXJ5LmFmdGVyVGVzdENhc2VIb29rRGVmaW5pdGlvbnMuZmlsdGVyKFxuICAgICAgaG9va0RlZmluaXRpb24gPT4ge1xuICAgICAgICByZXR1cm4gaG9va0RlZmluaXRpb24uYXBwbGllc1RvVGVzdENhc2UodGhpcy50ZXN0Q2FzZSlcbiAgICAgIH1cbiAgICApXG4gIH1cblxuICBnZXRCZWZvcmVIb29rRGVmaW5pdGlvbnMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3VwcG9ydENvZGVMaWJyYXJ5LmJlZm9yZVRlc3RDYXNlSG9va0RlZmluaXRpb25zLmZpbHRlcihcbiAgICAgIGhvb2tEZWZpbml0aW9uID0+IHtcbiAgICAgICAgcmV0dXJuIGhvb2tEZWZpbml0aW9uLmFwcGxpZXNUb1Rlc3RDYXNlKHRoaXMudGVzdENhc2UpXG4gICAgICB9XG4gICAgKVxuICB9XG5cbiAgZ2V0U3RlcERlZmluaXRpb25zKHN0ZXApIHtcbiAgICByZXR1cm4gdGhpcy5zdXBwb3J0Q29kZUxpYnJhcnkuc3RlcERlZmluaXRpb25zLmZpbHRlcihzdGVwRGVmaW5pdGlvbiA9PiB7XG4gICAgICByZXR1cm4gc3RlcERlZmluaXRpb24ubWF0Y2hlc1N0ZXBOYW1lKHtcbiAgICAgICAgc3RlcE5hbWU6IHN0ZXAudGV4dCxcbiAgICAgICAgcGFyYW1ldGVyVHlwZVJlZ2lzdHJ5OiB0aGlzLnN1cHBvcnRDb2RlTGlicmFyeS5wYXJhbWV0ZXJUeXBlUmVnaXN0cnlcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIGludm9rZVN0ZXAoc3RlcCwgc3RlcERlZmluaXRpb24sIGhvb2tQYXJhbWV0ZXIpIHtcbiAgICByZXR1cm4gU3RlcFJ1bm5lci5ydW4oe1xuICAgICAgZGVmYXVsdFRpbWVvdXQ6IHRoaXMuc3VwcG9ydENvZGVMaWJyYXJ5LmRlZmF1bHRUaW1lb3V0LFxuICAgICAgaG9va1BhcmFtZXRlcixcbiAgICAgIHBhcmFtZXRlclR5cGVSZWdpc3RyeTogdGhpcy5zdXBwb3J0Q29kZUxpYnJhcnkucGFyYW1ldGVyVHlwZVJlZ2lzdHJ5LFxuICAgICAgc3RlcCxcbiAgICAgIHN0ZXBEZWZpbml0aW9uLFxuICAgICAgd29ybGQ6IHRoaXMud29ybGRcbiAgICB9KVxuICB9XG5cbiAgaXNTa2lwcGluZ1N0ZXBzKCkge1xuICAgIHJldHVybiB0aGlzLnJlc3VsdC5zdGF0dXMgIT09IFN0YXR1cy5QQVNTRURcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZVN0YXR1cyh0ZXN0U3RlcFJlc3VsdCkge1xuICAgIHN3aXRjaCAodGVzdFN0ZXBSZXN1bHQuc3RhdHVzKSB7XG4gICAgICBjYXNlIFN0YXR1cy5GQUlMRUQ6XG4gICAgICBjYXNlIFN0YXR1cy5BTUJJR1VPVVM6XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgdGhpcy5yZXN1bHQuc3RhdHVzICE9PSBTdGF0dXMuRkFJTEVEIHx8XG4gICAgICAgICAgdGhpcy5yZXN1bHQuc3RhdHVzICE9PSBTdGF0dXMuQU1CSUdVT1VTXG4gICAgICAgIClcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgdGhpcy5yZXN1bHQuc3RhdHVzID09PSBTdGF0dXMuUEFTU0VEIHx8XG4gICAgICAgICAgdGhpcy5yZXN1bHQuc3RhdHVzID09PSBTdGF0dXMuU0tJUFBFRFxuICAgICAgICApXG4gICAgfVxuICB9XG5cbiAgYXN5bmMgYXJvdW5kVGVzdFN0ZXAocnVuU3RlcEZuKSB7XG4gICAgdGhpcy5lbWl0KCd0ZXN0LXN0ZXAtc3RhcnRlZCcsIHsgaW5kZXg6IHRoaXMudGVzdFN0ZXBJbmRleCB9KVxuICAgIGNvbnN0IHRlc3RTdGVwUmVzdWx0ID0gYXdhaXQgcnVuU3RlcEZuKClcbiAgICBpZiAodGVzdFN0ZXBSZXN1bHQuZHVyYXRpb24pIHtcbiAgICAgIHRoaXMucmVzdWx0LmR1cmF0aW9uICs9IHRlc3RTdGVwUmVzdWx0LmR1cmF0aW9uXG4gICAgfVxuICAgIGlmICh0aGlzLnNob3VsZFVwZGF0ZVN0YXR1cyh0ZXN0U3RlcFJlc3VsdCkpIHtcbiAgICAgIHRoaXMucmVzdWx0LnN0YXR1cyA9IHRlc3RTdGVwUmVzdWx0LnN0YXR1c1xuICAgIH1cbiAgICB0aGlzLmVtaXQoJ3Rlc3Qtc3RlcC1maW5pc2hlZCcsIHtcbiAgICAgIGluZGV4OiB0aGlzLnRlc3RTdGVwSW5kZXgsXG4gICAgICByZXN1bHQ6IHRlc3RTdGVwUmVzdWx0XG4gICAgfSlcbiAgICB0aGlzLnRlc3RTdGVwSW5kZXggKz0gMVxuICB9XG5cbiAgYXN5bmMgcnVuKCkge1xuICAgIHRoaXMuZW1pdFByZXBhcmVkKClcbiAgICB0aGlzLmVtaXQoJ3Rlc3QtY2FzZS1zdGFydGVkJywge30pXG4gICAgYXdhaXQgdGhpcy5ydW5Ib29rcyh0aGlzLmJlZm9yZUhvb2tEZWZpbml0aW9ucywge1xuICAgICAgc291cmNlTG9jYXRpb246IHRoaXMudGVzdENhc2VTb3VyY2VMb2NhdGlvbixcbiAgICAgIHBpY2tsZTogdGhpcy50ZXN0Q2FzZS5waWNrbGVcbiAgICB9KVxuICAgIGF3YWl0IHRoaXMucnVuU3RlcHMoKVxuICAgIGF3YWl0IHRoaXMucnVuSG9va3ModGhpcy5hZnRlckhvb2tEZWZpbml0aW9ucywge1xuICAgICAgc291cmNlTG9jYXRpb246IHRoaXMudGVzdENhc2VTb3VyY2VMb2NhdGlvbixcbiAgICAgIHBpY2tsZTogdGhpcy50ZXN0Q2FzZS5waWNrbGUsXG4gICAgICByZXN1bHQ6IHRoaXMucmVzdWx0XG4gICAgfSlcbiAgICB0aGlzLmVtaXQoJ3Rlc3QtY2FzZS1maW5pc2hlZCcsIHsgcmVzdWx0OiB0aGlzLnJlc3VsdCB9KVxuICAgIHJldHVybiB0aGlzLnJlc3VsdFxuICB9XG5cbiAgYXN5bmMgcnVuSG9vayhob29rRGVmaW5pdGlvbiwgaG9va1BhcmFtZXRlcikge1xuICAgIGlmICh0aGlzLnNraXApIHtcbiAgICAgIHJldHVybiB7IHN0YXR1czogU3RhdHVzLlNLSVBQRUQgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5pbnZva2VTdGVwKG51bGwsIGhvb2tEZWZpbml0aW9uLCBob29rUGFyYW1ldGVyKVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJ1bkhvb2tzKGhvb2tEZWZpbml0aW9ucywgaG9va1BhcmFtZXRlcikge1xuICAgIGF3YWl0IFByb21pc2UuZWFjaChob29rRGVmaW5pdGlvbnMsIGFzeW5jIGhvb2tEZWZpbml0aW9uID0+IHtcbiAgICAgIGF3YWl0IHRoaXMuYXJvdW5kVGVzdFN0ZXAoKCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5ydW5Ib29rKGhvb2tEZWZpbml0aW9uLCBob29rUGFyYW1ldGVyKVxuICAgICAgfSlcbiAgICB9KVxuICB9XG5cbiAgYXN5bmMgcnVuU3RlcChzdGVwKSB7XG4gICAgY29uc3Qgc3RlcERlZmluaXRpb25zID0gdGhpcy5nZXRTdGVwRGVmaW5pdGlvbnMoc3RlcClcbiAgICBpZiAoc3RlcERlZmluaXRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHsgc3RhdHVzOiBTdGF0dXMuVU5ERUZJTkVEIH1cbiAgICB9IGVsc2UgaWYgKHN0ZXBEZWZpbml0aW9ucy5sZW5ndGggPiAxKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBleGNlcHRpb246IGdldEFtYmlndW91c1N0ZXBFeGNlcHRpb24oc3RlcERlZmluaXRpb25zKSxcbiAgICAgICAgc3RhdHVzOiBTdGF0dXMuQU1CSUdVT1VTXG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0aGlzLmlzU2tpcHBpbmdTdGVwcygpKSB7XG4gICAgICByZXR1cm4geyBzdGF0dXM6IFN0YXR1cy5TS0lQUEVEIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuaW52b2tlU3RlcChzdGVwLCBzdGVwRGVmaW5pdGlvbnNbMF0pXG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcnVuU3RlcHMoKSB7XG4gICAgYXdhaXQgUHJvbWlzZS5lYWNoKHRoaXMudGVzdENhc2UucGlja2xlLnN0ZXBzLCBhc3luYyBzdGVwID0+IHtcbiAgICAgIGF3YWl0IHRoaXMuYXJvdW5kVGVzdFN0ZXAoKCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5ydW5TdGVwKHN0ZXApXG4gICAgICB9KVxuICAgIH0pXG4gIH1cbn1cbiJdfQ==