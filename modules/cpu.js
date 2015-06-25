const _ = imports._;
const Graph = imports.graph;
const Base = imports.modules.Base;
const GTop = imports.modules.GTop;

function Module(){
    this.init.apply(this, arguments);
}

Module.prototype = {
    __proto__: Base.prototype,

    name: "cpu",
    display: _("CPU"),

    notificationFormat: "percent",

    init: function(){
        Base.prototype.init.apply(this, arguments);

        try {
            this.gtop = new GTop.glibtop_cpu;
            this.count = GTop.glibtop_get_sysinfo().ncpu;
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

        let labels = [], margin = 260 - this.count * 60;
        GTop.glibtop_get_cpu(this.gtop);
        for(var i = 0; i < this.count; ++i){
            this.history.usage.push([]);
            this.history.user.push([]);
            this.history.system.push([]);
            this.saveRaw("total", i, this.gtop.xcpu_total[i]);
            this.saveRaw("user", i, this.gtop.xcpu_user[i]);
            this.saveRaw("system", i, this.gtop.xcpu_sys[i]);

            labels.push(60);
        }
        this.buildSubMenu(labels, margin);
        this.buildMenuItem(_("User"), labels, margin);
        this.buildMenuItem(_("System"), labels, margin);
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
        GTop.glibtop_get_cpu(this.gtop);
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

    update: function(){
        for(var i = 0; i < this.count; ++i){
            this.setText(0, i, "percent", this.data.usage[i]);
            this.setText(1, i, "percent", this.data.user[i]);
            this.setText(2, i, "percent", this.data.system[i]);
        }
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

function BarGraph(){
    this.init.apply(this, arguments);
}

BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    draw: function(){
        this.begin(this.module.count);

        for(let i = 0; i < this.module.count; ++i){
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

        for(let i = 0; i < this.module.count; ++i){
            this.next("cpu" + (i % 4 + 1));

            if(this.settings.cpuSplit){
                this.line(this.history.user[i], i, this.module.count);
                this.setAlpha(.75);
                this.line(this.history.system[i], i, this.module.count);
            } else
                this.line(this.history.usage[i], i, this.module.count);
        }
    }
};
