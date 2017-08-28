const uuid = "system-monitor@pixunil";
const applet = imports.ui.appletManager.applets[uuid];

const _ = applet._;
const Graph = applet.graph;
const Modules = applet.modules;

const name = "cpu";
const display = _("CPU");
const additionalSettingKeys = ["split", "warning", "warning-time", "warning-mode", "warning-value"];
const colorSettingKeys = ["core1", "core2", "core3", "core4"];

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.BaseDataProvider.prototype,

    notificationFormat: "percent",

    count: 0,

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
            nice: [],
            system: [],
            iowait: []
        };

        this.data = {
            usage: [],
            user: [],
            nice: [],
            system: [],
            iowait: []
        };

        this.history = {
            usage: [],
            user: [],
            nice: [],
            system: [],
            iowait: []
        };

        Modules.GTop.glibtop_get_cpu(this.gtop);

        for(let i = 0; i < this.count; ++i){
            this.history.usage.push([]);
            this.history.user.push([]);
            this.history.nice.push([]);
            this.history.system.push([]);
            this.history.iowait.push([]);
            this.saveRaw("total", i, this.gtop.xcpu_total[i]);
            this.saveRaw("user", i, this.gtop.xcpu_user[i]);
            this.saveRaw("nice", i, this.gtop.xcpu_nice[i]);
            this.saveRaw("system", i, this.gtop.xcpu_sys[i]);
            // strictly speaking is it not correct to merge io with irq, but
            // for the sake of simplicity and space, sum them up
            this.saveRaw("iowait", i, this.gtop.xcpu_iowait[i] +
                this.gtop.xcpu_irq[i] + this.gtop.xcpu_softirq[i]);
        }
    },

    saveRaw: function(type, core, value){
        this.raw[type][core] = value;
    },

    saveData: function(type, core, value, dtotal){
        if(dtotal){
            let delta = value - this.raw[type][core];
            this.saveRaw(type, core, value);
            value = delta / dtotal;
        }

        this.data[type][core] = value;

        this.updateHistory(this.history[type][core], value);
    },

    getHistory: function(type, core){
        return this.history[type][core];
    },

    getData: function(){
        Modules.GTop.glibtop_get_cpu(this.gtop);

        let r = 0;
        for(var i = 0; i < this.count; ++i){
            let dtotal = this.gtop.xcpu_total[i] - this.raw.total[i];
            this.saveRaw("total", i, this.gtop.xcpu_total[i]);

            this.saveData("user", i, this.gtop.xcpu_user[i], dtotal);
            this.saveData("nice", i, this.gtop.xcpu_nice[i], dtotal);
            this.saveData("system", i, this.gtop.xcpu_sys[i], dtotal);
            this.saveData("iowait", i, this.gtop.xcpu_iowait[i] +
                this.gtop.xcpu_irq[i] + this.gtop.xcpu_softirq[i], dtotal);

            this.saveData("usage", i, this.data.user[i] + this.data.nice[i] +
                this.data.system[i] + this.data.iowait[i]);

            if(this.settings.cpuWarning){
                if(this.settings.cpuWarningMode === "avg")
                    r += this.data.usage[i];
                else
                    this.checkWarning(this.data.usage[i], _("CPU core %d usage was over %s for %fsec").format(i + 1), i);
            }
        }

        if(this.settings.cpuWarning && this.settings.cpuWarningMode === "avg")
            this.checkWarning(r / this.count, _("CPU usage was over %s for %fsec"));
    },

    onSettingsChanged: function(){
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
        this.margin = 260 - module.dataProvider.count * 60;

        for(let i = 0; i < module.dataProvider.count; ++i)
            this.labelWidths.push(60);

        Modules.BaseSubMenuMenuItem.prototype.init.call(this, module);

        this.addRow(_("User"));
        this.addRow(_("Nice"));
        this.addRow(_("System"));
        this.addRow(_("Waiting for I/O"));
    },

    update: function(){
        for(let i = 0; i < this.count; ++i){
            this.setText(0, i, "percent", this.data.usage[i]);
            this.setText(1, i, "percent", this.data.user[i]);
            this.setText(2, i, "percent", this.data.nice[i]);
            this.setText(3, i, "percent", this.data.system[i]);
            this.setText(4, i, "percent", this.data.iowait[i]);
        }
    }
};

function PanelLabel(){
    this.init.apply(this, arguments);
}

PanelLabel.prototype = {
    __proto__: Modules.PanelLabelPrototype,

    main: {
        core: /^(?:core|c)(\d+)$/i,
        average: /^(?:average|avg|all|a)$/i
    },

    defaultSub: "usage",
    sub: {
        user: /^(?:user|usr|u)$/i,
        nice: /^(?:nice|ni|n)$/i,
        system: /^(?:system|sys|s)$/i,
        iowait: /^(?:iowait|io)$/
    },

    core: function(core, sub){
        core = parseInt(core) - 1;

        if(0 > core || core > this.count)
            return null;

        return this.formatPercent(this.data[sub][core]);
    },

    average: function(sub){
        let value = 0;
        for(let i = 0; i < this.count; ++i)
            value += this.data[sub][i] / this.count;

        return this.formatPercent(value);
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
            this.next("core" + (i % 4 + 1));
            this.bar(this.data.user[i]);
            this.setAlpha(.875);
            this.bar(this.data.nice[i]);
            this.setAlpha(.75);
            this.bar(this.data.system[i]);
            this.setAlpha(.625);
            this.bar(this.data.iowait[i]);
        }
    }
};

const historyGraphDisplay = _("CPU History");

function HistoryGraph(){
    this.init.apply(this, arguments);
}

HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    draw: function(){
        this.begin(this.count, this.history.user[0].length);

        for(let i = 0; i < this.count; ++i){
            let core = i;

            // visit cores in reverse order for stack
            if(this.settings.appearance === "stack")
                core = this.count - i - 1;

            this.next("core" + (core % 4 + 1));

            if(this.settings.split === "total"){
                this.line(this.history.usage[core]);
            } else if(this.settings.split === "user-system") {
                // merge nice usage into user
                let user = this.history.user[core].map((value, j) => {
                    return value + this.history.nice[core][j];
                });

                // merge iowait and irq usage into system
                let system = this.history.system[core].map((value, j) => {
                    return value + this.history.iowait[core][j];
                });

                this.line(user, true);

                this.setAlpha(.75);
                this.line(system);
            } else {
                this.line(this.history.user[core], true);
                this.setAlpha(.875);
                this.line(this.history.nice[core], true);
                this.setAlpha(.75);
                this.line(this.history.system[core], true);
                this.setAlpha(.625);
                this.line(this.history.iowait[core]);
            }
        }
    }
};
