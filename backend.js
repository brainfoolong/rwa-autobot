"use strict";

var Widget = require(__dirname + "/../../../src/widget");
var WebSocketUser = require(__dirname + "/../../../src/websocketuser");
var hash = require(__dirname + "/../../../src/hash");
var vm = require('vm');

var widget = new Widget();

/**
 * On receive a server message
 * @param {RconServer} server
 * @param {RconMessage} message
 */
widget.onServerMessage = function (server, message) {
    var sandboxData = {
        "context": "serverMessage",
        "message": message.body
    };
    widget.executeAllScripts(server, sandboxData);
};

/**
 * On widget update cycle - Fired every 30 seconds for each server
 * @param {RconServer} server
 */
widget.onUpdate = function (server) {
    widget.executeAllScripts(server, {"context": "update"});
};

/**
 * On frontend message
 * @param {RconServer} server
 * @param {WebSocketUser} user
 * @param {string} action The action
 * @param {*} messageData Any message data received from frontend
 * @param {function} callback Pass an object as message data response for the frontend
 */
widget.onFrontendMessage = function (server, user, action, messageData, callback) {
    var programs = {};
    switch (action) {
        case "save":
            var id = messageData.id || hash.random(12);
            programs = widget.storage.get(server, "programs") || {};
            programs[id] = {
                "id": id,
                "script": messageData.script,
                "title": messageData.title,
                "active": messageData.active,
                "variables": {},
                "variableValues": messageData.variableValues
            };
            widget.storage.set(server, "programs", programs);
            widget.executeUserScript(server, id, messageData.script, {"context": "validate"});
            callback(this, programs[id]);
            break;
        case "delete":
            programs = widget.storage.get(server, "programs");
            if (programs && typeof programs[messageData.id] != "undefined") {
                delete programs[messageData.id];
                widget.storage.set(server, "programs", programs);
                callback(this, true);
                return;
            }
            callback(this, false);
            break;
        case "load":
            programs = widget.storage.get(server, "programs");
            if (programs && typeof programs[messageData.id] != "undefined") {
                callback(this, programs[messageData.id]);
                return;
            }
            callback(this, false);
            break;
        case "list":
            callback(this, widget.storage.get(server, "programs") || {});
            break;
        case "validate-script":
            callback(this, widget.executeUserScript(server, "", messageData.script, {"context": "validate"}));
            break;
    }
};

/**
 * Execute all active scripts
 * @param {RconServer} server
 * @param {object} sandboxData
 */
widget.executeAllScripts = function (server, sandboxData) {
    var programs = widget.storage.get(server, "programs") || {};

    for (var programsIndex in programs) {
        if (programs.hasOwnProperty(programsIndex)) {
            var programsRow = programs[programsIndex];
            if (programsRow.active) {
                // execute script and send a message to all connected users
                // send a message to all connected users
                var sandboxDataCopy = JSON.parse(JSON.stringify(sandboxData));
                var variables = {};
                for (var varIndex in programsRow.variables) {
                    if (programsRow.variables.hasOwnProperty(varIndex)) {
                        var varRow = programsRow.variables[varIndex];
                        variables[varIndex] = varRow.default;
                        if (typeof programsRow.variableValues[varIndex] != "undefined"
                            && programsRow.variableValues[varIndex] !== null) {
                            variables[varIndex] = programsRow.variableValues[varIndex];
                        }
                    }
                }
                var result = widget.executeUserScript(server, programsRow.id, programsRow.script, sandboxDataCopy, variables);
                result.program = {
                    "id": programsRow.id,
                    "title": programsRow.title
                };
                for (var i = 0; i < WebSocketUser.instances.length; i++) {
                    var user = WebSocketUser.instances[i];
                    if (!user || !user.server || server.id !== user.server.id) continue;
                    user.send("autobotExecutedScript", result);
                }
            }
        }
    }
};

/**
 * Execute a user script
 * @param {RconServer} server
 * @param {string} programId
 * @param {string} script
 * @param {object} sandboxData
 * @param {object=} variables
 */
widget.executeUserScript = function (server, programId, script, sandboxData, variables) {
    var logs = [];
    /**
     * Send a command
     * @param {string} message
     */
    sandboxData.cmd = function (message) {
        server.cmd(message);
    };
    /**
     * Log for browser console
     */
    sandboxData.log = function () {
        logs.push(Array.prototype.slice.call(arguments));
    };
    sandboxData.variable = {
        /**
         * Define an interface variable
         * @param {string} name
         * @param {string} type
         * @param {string} label
         * @param {*} defaultValue
         */
        add: function (name, type, label, defaultValue) {
            if (typeof sandboxData[name] != "undefined") {
                throw new Error("Variable '" + name + "' already used in this script, choose another name");
            }
            var programs = widget.storage.get(server, "programs") || {};
            if (typeof programs[programId] != "undefined") {
                var program = programs[programId];
                program.variables = program.variables || {};
                program.variableValues = program.variableValues || {};
                program.variables[name] = {
                    "type": type,
                    "label": label,
                    "default": defaultValue
                };
                widget.storage.set(server, "programs", programs);
            }
        },
        /**
         * Get a variable value
         * @param {string} name
         * @returns {*|null}
         */
        get: function (name) {
            if (!variables || typeof variables[name] == "undefined") return null;
            return variables[name];
        }
    };
    sandboxData.storage = {
        /**
         * Get a storage value
         * @param {string} key
         * @returns {*|null}
         */
        get: function (key) {
            return widget.storage.get(server, "autobot." + programId + "." + key);
        },
        /**
         * Get a storage value
         * @param {string} key
         * @param {*} value
         * @param {number=} lifetime
         * @returns {*|null}
         */
        set: function (key, value, lifetime) {
            return widget.storage.set(server, "autobot." + programId + "." + key, value, lifetime);
        }
    };
    var empty = function () {

    };
    if (sandboxData.context == "validate") {
        sandboxData.cmd = empty;
        sandboxData.storage.get = empty;
        sandboxData.storage.set = empty;
        sandboxData.variable.get = empty;
    }else{
        sandboxData.variable.add = empty;
    }
    try {
        var vmScript = new vm.Script(script, {"timeout": 5});
        var context = new vm.createContext(sandboxData);
        vmScript.runInContext(context);
        return {
            "logs": logs
        };
    } catch (e) {
        var s = e.stack.split("\n");
        var line = s[1].match(/\:([0-9]+\:[0-9]+)$/);
        return {
            "error": e.message + " on line " + (line ? line[1] : "")
        };
    }
};

module.exports = widget;