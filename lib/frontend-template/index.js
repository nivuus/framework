/*
 * Copyright 2020 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by Maxime Allanic <maxime@allanic.me> at 26/03/2020
 */

const $fs = require('fs');
const $q = require('q');
const $lodash = require('lodash');
const $path = require('path');
const $stream = require('stream');
const $browserify = require('browserify');
const $minify = require('minify');
const $arrayBufferToString = require('arraybuffer-to-string');

const MinifyOptions = {
    js: {
        mangle: false
    }
};

module.exports = class Template {
    constructor (config) {
        this._config = config;
        this._javascripts = [];
        this._templates = {};
        this._styles = [];
        this._metas = {};
    }

    addTemplate(template) {

        var path = '/template/' + $path.relative(process.cwd(), template);
        this._templates[ path ] = template;
        return path;
    }

    async addScript(file) {
        var content = await $q.nfcall($fs.readFile, file);
        this._javascripts.push(content);
    }

    async addStyle(file) {
        var content = await $q.nfcall($fs.readFile, file);
        this._styles.push(content);
    }

    setMeta(key, value) {
        this._metas[key] = value;
    }

    async _compileJavascript(contents, params) {


        var s = new $stream.Readable();
        contents.forEach((content) => {
            content = $lodash.template(content)(params);
            s.push(content);
        });
        s.push(null);

        var configuredBrowserify = $browserify(s, {
            basedir: __dirname + '/../../',
            ignoreMissing: true,
            paths: [
                $path.join(process.cwd(), 'node_modules'),
                $path.join(__dirname, '/../../node_modules')
            ]
        });
        contents = await $q.ninvoke(configuredBrowserify, 'bundle');

        contents = $arrayBufferToString(contents);
        if (!this._config.debug)
            contents = $minify.js(contents, MinifyOptions);

        return contents;
    }

    async _compileTemplate(content, params) {

        content = $lodash.template(content)(params);
        if (!this._config.debug)
            content = $minify.html(content, MinifyOptions);
        return content;
    }

    async _compileStyle(content, params) {

        content = $lodash.template(content.join('\n'))(params);
        if (!this._config.debug)
            content = $minify.css(content, MinifyOptions);
        return content;
    }

    async generateRoutes(express, params) {

        // Load global js
        await require('./' + params.frontend)(this, params);


        var allJs = await this._compileJavascript(this._javascripts, params);
        express.use("/bundle.min.js", function (request, response) {
            response.set('Content-Type', 'application/javascript');
            response.send(allJs);
        });

        var allStyle = await this._compileStyle(this._styles, params);
        express.use("/bundle.min.css", function (request, response) {
            response.set('Content-Type', 'text/css');
            response.send(allStyle);
        });

        await $q.all($lodash.map(this._templates, async (template, path) => {
            var content = await $q.nfcall($fs.readFile, template);
            var index = await this._compileTemplate(content, params);

            express.use(path, function (request, response) {
                response.set('Content-Type', 'text/html');
                response.send(index);
            });
        }));

        params = $lodash.assign(params, {
            styles: this._styles,
            templates: this._templates,
            metas: this._metas,
            body: this._config.body
        });

        var content = await $q.nfcall($fs.readFile, $path.join(__dirname, params.frontend, 'index.html.ejs'));
        var index = await this._compileTemplate(content, params);
        express.use("/*", function (request, response) {
            response.set('Content-Type', 'text/html');
            response.send(index);
        });
    }
};