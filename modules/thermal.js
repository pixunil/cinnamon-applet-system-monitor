const _ = imports.applet._;
const Graph = imports.applet.graph;
const Modules = imports.applet.modules;

const name = "thermal";
const display = _("Thermal");
const additionalSettingKeys = ["mode", "warning", "warning-time", "warning-value"];
const colorSettingKeys = ["thermal", "disk"];

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.SensorDataProvider.prototype,

    notificationFormat: "thermal",

    dataMatcher: /([+-]?\d+\.\d+)\xb0C/,

    init: function(){
        this.colorRefs = [];

        Modules.SensorDataProvider.prototype.init.apply(this, arguments);

        try {
            this.client = Modules.UDisks.Client.new_sync(null, null);
        } catch(e){}

        if(this.client){
            this.client.get_object_manager().get_objects().forEach(object => {
                // check if object is a drive
                if(!object.drive || !object.drive_ata)
                    return;

                // check if drive supports temperature
                if(!object.drive_ata.smart_enabled || !object.drive_ata.smart_temperature)
                    return;

                let id = "udisks-" + object.drive.id;

                this.sensorsAvailable[id] = {
                    type: "udisks",
                    proxy: object.drive_ata,
                    name: object.drive.id,
                    color: "disk"
                };
                this.history.push([]);
            });
        }

        this.compareSensorsConfig();
    },

    parseSensorLine: function(line, lineNumber){
        let name = line.match(/[^:]+/)[0];
        let color = "thermal";
        let coreMatch = name.match(/core\s*(\d)/i);

        if(coreMatch !== null)
            color = "core" + (parseInt(coreMatch[1]) % 4 + 1);

        let id = "sensors-" + lineNumber;
        this.sensorsAvailable[id] = {
            type: "sensors",
            line: lineNumber,
            name: name,
            color: color
        };
        this.history.push([]);
    },

    getData: function(result){
        Modules.SensorDataProvider.prototype.getData.call(this, result);

        if(this.settings.thermalWarning)
            this.checkWarning(this.data[0], _("Temperature was over %s for %fsec"));
    },

    onSettingsChanged: function(){
        if(this.settings.thermalWarning){
            this.notifications = this.settings.thermalWarningTime;

            // Fahrenheit => Celsius
            if(this.settings.thermalUnit === "fahrenheit")
                this.settings.thermalWarningValue = (this.settings.thermalWarningValue - 32) * 5 / 9;
        }
    }
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

        module.dataProvider.sensors.forEach(sensor => {
            this.addRow(sensor.name);
        });
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
    __proto__: Modules.PanelLabelPrototype,

    main: {
        value: /^(?:value|v|min|max|m|average|avg|a)$/i,
        sensor: /^(?:sensor|s)(\d+)$/i
    },

    value: function(){
        return this.formatThermal(this.data[0]);
    },

    sensor: function(sensor){
        sensor = parseInt(sensor);
        return this.formatThermal(this.data[sensor]);
    }
};

function BarGraph(){
    this.init.apply(this, arguments);
}

BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    draw: function(){
        this.begin(1);

        this.next("thermal");
        this.bar((this.data[0] - this.module.min) / (this.module.max - this.module.min));
    }
};

const historyGraphDisplay = _("Thermal History");

function HistoryGraph(){
    this.init.apply(this, arguments);
}

HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    draw: function(){
        this.begin(this.history.length, this.history[0].length, this.module.max, this.module.min);

        this.section = 0;

        // first draw the sensors
        for(let i = 1, l = this.history.length; i < l; ++i){
            let color = this.sensors[i - 1].color;

            // borrow the cpu colors from the cpu module
            if(color.startsWith("core"))
                color = this.modules.cpu.color[color];

            this.next(color);
            this.line(this.history[i], i, l);
        }

        // then the min / average / max data
        this.next("thermal");
        this.section = 0;
        this.ctx.setDash([5, 5], 0);
        this.line(this.history[0], 0, this.history.length);
    }
};
