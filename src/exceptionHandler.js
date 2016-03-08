(function () {
    'use strict';

    var __logger;

    /**
     * init `exceptionHandler`
     */
    angular
        .module('core')
        .run(handleWindowError)
        .config(handleAngularError);

    /**
     * dynamic inject logger service to make logger can be custom by actual requirements
     * @param $injector {Object}
     * @returns {Object}
     */
    function injectLogger($injector) {

        var serviceName = 'logger';

        return __logger || (
                __logger = $injector.has(serviceName) &&
                    $injector.get(serviceName) || {
                        /**
                         * error logger function
                         * @param type {string} enum:'window.error'|'angular.error'
                         * @param exception {Object} the object of error
                         * @param exception.message {string} exception message string
                         * @param {string} [exception.file] exception file path
                         * @param {number} [exception.line] exception file line number
                         */
                        error: function (type, exception) {
                            console.warn(
                                'exceptionHandler: Implement `logger.error()` to log the error. ',
                                arguments
                            );
                        }
                    }
            );
    }

    /**
     * handle window.onerror event
     * @ngInject
     */
    function handleWindowError($injector) {

        var oldOnError = window.onerror;

        window.onerror = function (errorMsg, file, lineNumber) {

            // handler window error
            injectLogger($injector).error(
                'window.error',
                {message: errorMsg, file: file, line: lineNumber}
            );

            // call origin window.onerror
            if (oldOnError) {
                return oldOnError.call(this, arguments);
            }

            // keep origin invoke
            return false;
        };
    }

    /**
     * handle all the angular error. handle the errors called by $log.error(),
     * include all the angular inner error and manually invoked $log.error.
     * @param $provide
     * @ngInject
     */
    function handleAngularError($provide) {

        /**
         * decorate $log to handle $log.error call
         *
         * DESC：$exceptionHandler will call $log.error at last，so just need decorate $log
         */
        $provide.decorator("$log", $logDecorator);

        /**
         * doing decorator
         * @param $delegate
         * @param $injector
         * @returns {*}
         * @ngInject
         */
        function $logDecorator($delegate, $injector) {

            var oldError = $delegate.error;

            $delegate.error = function () {

                var exception,
                    messages = [],
                    messageSeparator = ' ';

                var toStr = function (o) {
                    return typeof o === 'string' ? o : JSON.stringify(o);
                };

                // 1.call origin window.onerror
                oldError.apply($delegate, arguments);

                // 2.concat error messages
                //  rules:
                //      1)concat multiple messages in sequence
                //      2)other properties based on the first object
                //          which own `message` property
                angular.forEach(arguments, function (arg) {

                    if (exception) {
                        exception.message += messageSeparator + toStr(arg);
                    } else if (angular.isObject(arg) && ('message' in arg)) {
                        exception = arg;
                        messages.push(exception.message);
                        exception.message = messages.join(messageSeparator);
                    } else {
                        messages.push(toStr(arg));
                    }

                });

                // 3.build error object
                if (!exception) {
                    exception = {message: messages.join(messageSeparator)};
                }

                // 4.call the logger
                injectLogger($injector).error('angular.error', exception);
            };

            return $delegate;
        }
    }

})();
