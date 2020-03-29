/*
 * Copyright 2020 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by Maxime Allanic <maxime@allanic.me> at 26/03/2020
 */

const $getFunctionArgs = require('get-function-arguments');
const $glob = require('glob');
const $q = require('q');
const $lodash = require('lodash');
const Proxify = require('@nivuus/proxify');

module.exports.ServiceManager = class ServiceManager {
    constructor (path) {
        this._browserServices = {};
        this._sessionServices = {};
        this._services = {};
    }

    addBrowserService(name, fn) {
        fn.$inject = $getFunctionArgs(fn);
        this._browserServices[ name ] = fn;
    }

    addSessionService(name, fn) {
        fn.$inject = $getFunctionArgs(fn);
        this._sessionServices[ name ] = fn;
    }

    addService(name, fn) {
        fn.$inject = $getFunctionArgs(fn);
        this._services[ name ] = fn;
    }


    async invoke(fn, thisArg, additionalServices) {
        const self = this;
        var services = $getFunctionArgs(fn);
        services = await $q.all($lodash.map(services, (service) => {
            if (additionalServices[ service ])
                return additionalServices[ service ];
            else if (self._services[ service ])
                return self._services[ service ];
            else
                throw new Error(`${ service } service not found`);
        }));
        return fn.apply(thisArg, services);
    }
}

module.exports.SessionServiceManager = class SessionServiceManager {
    constructor (serviceManager, session) {
        this._serviceManager = serviceManager;
        this._session = session;
        this._services = {};

        const self = this;
        $lodash.forEach(this._serviceManager._services, (service, name) => {
            if (!Proxify.isProxy(service)) {
                var proxified = new Proxify({});
                self._serviceManager._services[name] = self._serviceManager.invoke(service, proxified);
            }
            self._services[ name ] = $q.resolve(service);
        });

        $lodash.forEach(this._serviceManager._sessionServices, (service, name) => {
            var proxified = new Proxify({});
            self.invoke(service, proxified);
            self._services[ name ] = $q.resolve(proxified);
        });

        $lodash.forEach(this._serviceManager._browserServices, (service, name) => {
            var deferred = $q.defer();
            self._services[ name ] = deferred.promise;
            self._session.on(`service:${ name }`, (proxified) => {
                deferred.resolve(proxified);
                return proxified;
            });
        });

    }

    async invoke(fn, thisArg, additionalServices) {
        const self = this;
        var services = $getFunctionArgs(fn);
        services = await $q.all($lodash.map(services, (service) => {
            if (additionalServices[ service ])
                return additionalServices[ service ];
            else if (self._services[ service ])
                return self._services[ service ];
            else
                throw new Error(`${ service } service not found`);
        }));
        return fn.apply(thisArg, services);
    }
}