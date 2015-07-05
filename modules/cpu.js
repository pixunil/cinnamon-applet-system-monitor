const _ = imports._;
const Graph = imports.graph;
const Modules = imports.modules;

const name = "cpu";
const display = _("CPU");

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.BaseDataProvider.prototype,

    notificationFormat: "percent",

    init: function(){
        Modules.BaseDataProvider.prototype.init.apply(this, arguments);

        try {
            this.gtop = new Modules.GTop.glibtop_cpu;
            this.count = Modules.GTop.glibtop_get_sysinfo().ncpu;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.raw = {
            total: [],
            user: [],
            system: []
        };

        this.data = {
            usage: [],
            user: [],
            system: []
        };

        this.history = {
            usage: [],
            user: [],
            system: []
        };

        Modules.GTop.glibtop_get_cpu(this.gtop);

        for(let i = 0; i < this.count; ++i){
            this.history.usage.push([]);
            this.history.user.push([]);
            this.history.system.push([]);
            this.saveRaw("total", i, this.gtop.xcpu_total[i]);
            this.saveRaw("user", i, this.gtop.xcpu_user[i]);
            this.saveRaw("system", i, this.gtop.xcpu_sys[i]);
        }
    },

    saveRaw: function(type, core, value){
        this.raw[type][core] = value;
    },

    saveData: function(type, core, value, raw){
        this.data[type][core] = value;

        if(raw)
            this.saveRaw(type, core, raw);

        this.updateHistory(this.history[type][core], value);
    },

    getHistory: function(type, core){
        return this.history[type][core];
    },

    getData: function(){
        Modules.GTop.glibtop_get_cpu(this.gtop);

        var dtotal, duser, dsystem, r = 0;
        for(var i = 0; i < this.count; ++i){
            dtotal = this.gtop.xcpu_total[i] - this.raw.total[i];
            duser = this.gtop.xcpu_user[i] - this.raw.user[i];
            dsystem = this.gtop.xcpu_sys[i] - this.raw.system[i];

            this.saveRaw("total", i, this.gtop.xcpu_total[i]);
            this.saveData("user", i, duser / dtotal, this.gtop.xcpu_user[i]);
            this.saveData("system", i, dsystem / dtotal, this.gtop.xcpu_sys[i]);
            this.saveData("usage", i, (duser + dsystem) / dtotal);

            if(this.settings.cpuWarning){
                if(this.settings.cpuWarningMode)
                    r += this.data.usage[i];
                else
                    this.checkWarning(this.data.usage[i], "CPU core " + (i + 1) + " usage was over %s for %fsec", i);
            }
        }

        if(this.settings.cpuWarning && this.settings.cpuWarningMode)
            this.checkWarning(r / this.count, "CPU usage was over %s for %fsec");
    },

    panelLabel: {
        _percent: function(n, prop){
            if(n === "a"){
                let value = 0;
                for(var i = 0; i < this.count; ++i)
                    value += this.data[prop][i] / this.count;
                return this.format("percent", value);
            } else if(n - 0 > -1 && n - 0 < this.count)
                return this.format("percent", this.data[prop][n - 0]);
            return false;
        },

        t: function(n){
            return this.panelLabel._percent.call(this, n, "usage");
        },
        u: function(n){
            return this.panelLabel._percent.call(this, n, "user");
        },
        s: function(n){
            return this.panelLabel._percent.call(this, n, "system");
        }
    },

    onSettingsChanged: function(){
        Base.prototype.onSettingsChanged.call(this);

        if(this.settings.cpuWarning){
            if(this.settings.cpuWarningMode)
                this.notifications = this.settings.cpuWarningTime;
            else {
                this.notifications = [];
                for(var i = 0; i < this.count; ++i)
                    this.notifications.push(this.settings.cpuWarningTime);
            }
            this.settings.cpuWarningValue /= 100;
        }
    }
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.BaseSubMenuMenuItem.prototype,

    init: function(module){
        this.labelWidths = [];
        this.margin = 260 - module.count * 60;

        for(let i = 0; i < module.count; ++i)
            this.labelWidths.push(60);

        Modules.BaseSubMenuMenuItem.prototype.init.call(this, module);

        this.addRow(_("User"));
        this.addRow(_("System"));
    },

    update: function(){
        for(let i = 0; i < this.count; ++i){
            this.setText(0, i, "percent", this.data.usage[i]);
            this.setText(1, i, "percent", this.data.user[i]);
            this.setText(2, i, "percent", this.data.system[i]);
        }
    }
};

function BarGraph(){
    this.init.apply(this, arguments);
}

BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    draw: function(){
        this.begin(this.count);

        for(let i = 0; i < this.count; ++i){
            this.next("cpu" + (i % 4 + 1));
            this.bar(this.data.user[i]);

            this.setAlpha(.75);
            this.bar(this.data.system[i]);
        }
    }
};

function HistoryGraph(){
    this.init.apply(this, arguments);
}

HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    draw: function(){
        this.begin(this.history.user[0].length);

        for(let i = 0; i < this.count; ++i){
            this.next("cpu" + (i % 4 + 1));

            if(this.settings.cpuSplit){
                this.line(this.history.user[i], i, this.count);
                this.setAlpha(.75);
                this.line(this.history.system[i], i, this.count);
            } else
                this.line(this.history.usage[i], i, this.count);
        }
    }
};
