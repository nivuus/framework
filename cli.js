#!/usr/bin/env node

/*
 * Copyright 2020 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by Maxime Allanic <maxime@allanic.me> at 25/03/2020
 */

const Framework = require('./index');
const $chalk = require('chalk');

const $projectPackage = require(process.cwd() + '/package.json');
$projectPackage.config.debug = true;
const $framework = new Framework($projectPackage.config);
$framework.start()
    .then((config) => {
        var shouldDisplayPort = (config.isSslEnabled && config.port !== 443) || (!config.isSslEnabled && config.port !== 80);
        var path = (config.isSslEnabled ? 'https' : 'http') + '://' + config.host + (shouldDisplayPort ? `:${config.port}/` : '/');
        console.log($chalk`{magenta ${$projectPackage.name}} is loaded on {blue ${path}}`);
    }, (error) => {
            console.error(error);
    });