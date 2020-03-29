/*
 * Copyright 2020 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by Maxime Allanic <maxime@allanic.me> at 25/03/2020
 */

const $lodash = require('lodash');
const $q = require('q');
const $glob = require('glob');
const $path = require('path');
const $http = require('http');
const $realtimeObjectTransmission = require('@nivuus/realtime-object-transmission');
const $service = require('./service');
const Template = require('./frontend-template');

module.exports = class AssetManager {
    constructor (app, server, config) {
        this._app = app;
        this._server = new $realtimeObjectTransmission.Server(server);
        this._config = config;
        this.template = new Template(config);
        this._serviceManager = new $service.ServiceManager(config.service);
    }

    async load() {
        const self = this;


        var config = {
            frontend: 'angular-js',
            services: await this._loadServices(),
            directives: await this._loadDirectives(),
            filters: await this._loadFilters(),
            controllers: await this._loadControllers()
        }

        await this.template.generateRoutes(self._app, config);
    }

    async _loadServices() {
        const self = this;
        var services = {};
        var files = await $q.nfcall($glob, this._config.service + '/*');
        files.push(__dirname + '/service/browser');
        await $q.all($lodash.map(files, async (file) => {
            var service = require(file);
            var name = $path.basename($path.relative(self._config.directive, file), '.js');
            if (service.type === 'browser')
                await self._serviceManager.addBrowserService(name, service);
            else if (service.type === 'session')
                await self._serviceManager.addSessionService(name, service);
            else
                await self._serviceManager.addService(name, service);
            services[name] = service;
        }));
        return services;
    }

    async _loadDirectives() {
        const self = this;
        var directives = {};
        var files = await $q.nfcall($glob, this._config.directive + '/*');
        await $q.all($lodash.map(files, (file) => {
            var directive = require(file);
            var name = $path.basename($path.relative(self._config.directive, file), '.js');
            directives[name] = directive;
        }));
        return directives;
    }

    async _loadFilters() {
        const self = this;
        var filters = {};
        var files = await $q.nfcall($glob, this._config.filter + '/*');
        await $q.all($lodash.map(files, (file) => {
            var filter = require(file);
            var name = $path.basename($path.relative(self._config.filter, file), '.js');
            filters[name] = filter;
        }));
        return filters;
    }

    async _loadControllers() {
        const self = this;
        var controllers = {};
        var files = await $q.nfcall($glob, this._config.controller + '/**/');
        await $q.all($lodash.map(files, (file) => {
            var controller = require(file);
            var path = $path.relative(self._config.controller, file);
            var name = $lodash.replace(path, /\//g, '.');
            if (name)
                name = 'main.' + name;
            else
                name = 'main';
            controllers[ name ] = {
                path: '/' + path,
                fn: controller,
                template: self.template.addTemplate(file + 'index.html')
            };


        }));

        self._server.onConnection((session) => {
            var sessionServiceManager = new $service.SessionServiceManager(self._serviceManager, session);

            $lodash.forEach(controllers, (controller, name) => {
                session.on(name, async (params) => {
                    var proxy = await session.newObject({});
                    await sessionServiceManager.invoke(controller.fn, proxy, {
                        $params: params
                    });
                    return proxy;
                });
            });

        });
        return controllers;
    }
}