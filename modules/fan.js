const GLib = imports.gi.GLib;

const _ = imports._;
const Graph = imports.graph;
const bind = imports.bind;
const Terminal = imports.terminal;
const Modules = imports.modules;

const name = "fan";
const display = _("Fan");
const additionalSettingKeys = ["mode", "warning", "warning-time", "warning-value"];
const colorSettingKeys = ["fan"];

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.BaseDataProvider.prototype,

    path: "",

    min: null,
    max: null,

    notificationFormat: "rpm",

    init: function(){
        Modules.BaseDataProvider.prototype.init.apply(this, arguments);

        this.data = [];
        this.history = [[]];

        this.sensors = [];
        this.sensorNames = [];

        let result = GLib.spawn_command_line_sync("which sensors");

        if(!result[0] || result[3] !== 0){
            this.unavailable = true;
            return;
        }

        this.path = result[1].toString().split("\n", 1)[0];
        let lines = GLib.spawn_command_line_sync(this.path)[1].toString().split("\n");
        let inAdapter = false;

        for(let i = 0, l = lines.length; i < l; ++i){
            let line = lines[i];

            if(line.substr(0, 8) === "Adapter:"){
                if(line.match(/virtual/i))
                    inAdapter = false;
                else
                    inAdapter = true;
            }

            if(inAdapter && line.match(/\d+.\d+ RPM/))
                this.parseSensorLine(line, i);
        }

        if(!this.sensors.length)
            this.unavailable = true;
    },

    parseSensorLine: function(line, lineNumber){
        // extract the name (the chars before the first colon), but remove "fan speed"
        let name = line.match(/^(.+?)(?:fan speed)?:/i)[1];

        this.sensors.push(lineNumber);
        this.sensorNames.push(name);
        this.history.push([]);
    },

    getData: function(){
        Terminal.call(this.path, bind(this.parseResult, this));
    },

    parseResult: function(result){
        this.time[1] = GLib.get_monotonic_time() / 1e6;

        result = result.split("\n");
        let rpm = 0;
        let l = this.sensors.length;
        for(let i = 0; i < l; ++i){
            this.saveData(i + 1, parseFloat(result[this.sensors[i]].match(/\d+\.\d+/)));

            if(this.settings.fanMode === "min" && rpm > this.data[i + 1] || rpm === 0)
                rpm = this.data[i + 1];
            else if(this.settings.fanMode === "avg")
                rpm += this.data[i + 1];
            else if(this.settings.fanMode === "max" && rpm < this.data[i + 1])
                rpm = this.data[i + 1];
        }

        if(this.settings.fanMode === "avg")
            rpm /= l;

        this.saveData(0, rpm);

        this.updateMinMax();

        if(this.settings.fanWarning)
            this.checkWarning(temp, _("Fan rotation was over %s for %fsec"));
    },

    onSettingsChanged: function(){
        if(this.settings.fanWarning)
            this.notifications = this.settings.fanWarningTime;
    },
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.BaseSubMenuMenuItem.prototype,

    labelWidths: [80],
    margin: 180,

    init: function(module){
        Modules.BaseSubMenuMenuItem.prototype.init.call(this, module);

        for(let i = 0, l = module.dataProvider.sensorNames.length; i < l; ++i)
            this.addRow(module.dataProvider.sensorNames[i]);

        delete module.dataProvider.sensorNames;
    },

    update: function(){
        for(let i = 0, l = this.data.length; i < l; ++i)
            this.setText(i, 0, "thermal", this.data[i]);
    }
};

function PanelLabel(){
    this.init.apply(this, arguments);
}

PanelLabel.prototype = {
    __proto__: Modules.ModulePartPrototype,

    main: {
        value: /^(?:value|v|min|max|m|average|avg|a)$/i,
        sensor: /^(?:sensor|s)(\d+)$/i
    },

    value: function(){
        return this.formatRPM(this.data[0]);
    },

    sensor: function(sensor){
        sensor = parseInt(sensor);
        return this.formatRPM(this.data[sensor]);
    }
};

function BarGraph(){
    this.init.apply(this, arguments);
}

BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    draw: function(){
        this.begin(1);

        this.next("fan");
        this.bar((this.data[0] - this.module.min) / (this.module.max - this.module.min));
    }
};

const historyGraphDisplay = _("Fan History");

function HistoryGraph(){
    this.init.apply(this, arguments);
}

HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    draw: function(){
        this.begin(this.history.length, this.history[0].length, 1, this.module.max, this.module.min);

        this.section = 0;

        // first draw the sensors
        for(let i = 1, l = this.history.length; i < l; ++i){
            this.next("fan");
            this.setAlpha((l - i / 4) / l);

            this.line(this.history[i], i, l);
        }

        // then the min / average / max data
        this.next("fan");
        this.section = 0;
        this.ctx.setDash([5, 5], 0);
        this.line(this.history[0], 0, this.history.length);
    }
};
