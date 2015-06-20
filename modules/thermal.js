const GLib = imports.gi.GLib;

const _ = imports._;
const bind = imports.bind;
const Terminal = imports.terminal;
const Base = imports.modules.Base;

function Module(){
    this.init.apply(this, arguments);
}

Module.prototype = {
    __proto__: Base.prototype,

    name: "thermal",
    display: _("Thermal"),

    path: "",

    min: null,
    max: null,

    notificationFormat: "thermal",

    init: function(){
        Base.prototype.init.apply(this, arguments);

        this.data = [];
        this.history = [[]];

        this.sensors = [];
        this.colorRef = [];

        let labels = [80], margin = 180;
        this.buildSubMenu(labels, 180);
        let r = GLib.spawn_command_line_sync("which sensors");
        if(r[0] && r[3] === 0){
            this.path = r[1].toString().split("\n", 1)[0];
            r = GLib.spawn_command_line_sync(this.path)[1].toString().split("\n");
            for(var i = 0, l = r.length, s; i < l; ++i){
                if(r[i].substr(0, 8) === "Adapter:" && !r[i].match(/virtual/i)){
                    s = r[i].substr(9);
                    for(++i; r[i] && r[i].substr(0, 8) !== "Adapter:"; ++i){
                        if(r[i].match(/\d+.\d+\xb0C/)){
                            let name = r[i].match(/[^:]+/)[0];
                            let coreMatch = name.match(/core\s*(\d)/i);

                            if(coreMatch !== null) this.colorRef.push(parseInt(coreMatch[1]) % 4 + 1);
                            else this.colorRef.push(null);

                            this.buildMenuItem(name, labels, margin);
                            this.sensors.push(i);
                            this.history.push([]);
                        }
                    }
                }
            }
        }

        if(!this.sensors.length)
            this.unavailable = true;
    },

    getData: function(){
        Terminal.call(this.path, bind(this.parseResult, this));
    },

    parseResult: function(result){
        this.time[1] = GLib.get_monotonic_time() / 1e6;

        result = result.split("\n");
        let temp = 0;
        for(var i = 0, l = this.sensors.length; i < l; ++i){
            this.saveData(i + 1, parseFloat(result[this.sensors[i]].match(/\d+\.\d+/)));

            if(this.settings.thermalMode === 0 && temp > this.data[i + 1] || temp === 0)
                temp = this.data[i + 1];
            else if(this.settings.thermalMode === 1)
                temp += this.data[i + 1];
            else if(this.settings.thermalMode === 2 && temp < this.data[i + 1])
                temp = this.data[i + 1];
        }

        if(this.settings.thermalMode === 1)
            temp /= l;
        this.saveData(0, temp);

        this.updateMinMax();

        if(this.settings.thermalWarning)
            this.checkWarning(temp, "Temperature was over %s for %fsec");
    },

    update: function(){
        for(var i = 0, l = this.data.length; i < l; ++i)
            this.setText(i, 0, "thermal", this.data[i]);
    },

    panelLabel: {
        t: function(n){
            if(this.data[n - 0])
                return this.format("thermal", this.data[n - 0]);

            return false;
        }
    },

    onSettingsChanged: function(){
        Base.prototype.onSettingsChanged.call(this);
        if(this.settings.thermalWarning){
            this.notifications = this.settings.thermalWarningTime;
            if(!this.settings.thermalUnit)
                this.settings.thermalWarningValue = (this.settings.thermalWarningValue - 32) * 5 / 9; // Fahrenheit => Celsius
        }
    },

    menuGraph: "ThermalHistory",
    panelGraphs: ["ThermalBar", "ThermalHistory"]
};
