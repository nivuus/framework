/*
 * Copyright 2020 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by Maxime Allanic <maxime@allanic.me> at 25/03/2020
 */

const $lodash = require('lodash');
const $express = require('express');
const $http = require('http');
const $path = require('path');
const AssetManager = require('./lib/asset-manager');

module.exports = class Framework {
    constructor (config) {
        this._config = $lodash.defaults(config, {
            path: process.cwd(),
            controller: process.cwd() + '/controller',
            filter: process.cwd() + '/filter',
            directive: process.cwd() + '/directive',
            service: process.cwd() + '/service',
            asset: process.cwd() + '/assets',
            enableSsl: false,
            host: '127.0.0.1',
            port: 80
        });

        this._app = $express();
        this._app.use($express.static(this._config.asset));
        this._server = $http.Server(this._app);
        this._assetManager = new AssetManager(this._app, this._server, this._config);

        const self = this;
        $lodash.forEach($lodash.castArray(this._config.css), (css) => {
            self._assetManager.template.addStyle($path.join(this._config.path, css));
        });

        $lodash.forEach($lodash.castArray(this._config.js), (js) => {
            self._assetManager.template.addScript($path.join(this._config.path, js));
        });
    }

    async start() {
        const self = this;
        await self._assetManager.load();
        return new Promise((resolve) => {
            self._server.listen(self._config.port, () => {
                resolve({
                    host: self._config.host,
                    port: self._config.port,
                    isSslEnabled: self._config.enableSsl
                });
            });
        });
    }
};