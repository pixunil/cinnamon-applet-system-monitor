const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;

const Mainloop = imports.mainloop;

const messageTray = Main.messageTray;

const uuid = "system-monitor@pixunil";
const MAXSIZE = 1500;
imports.ui.appletManager.applets[uuid].init.init("modules");

const Terminal = appletDirectory.terminal;

try {
    const GTop = imports.gi.GTop;
} catch(e){
    let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.FULLCOLOR, icon_size: 24});
    Main.criticalNotify(_("Dependence missing"), _("Please install the GTop package\n" +
        "\tUbuntu / Mint: gir1.2-gtop-2.0\n" +
        "\tFedora: libgtop2-devel\n" +
        "\tArch: libgtop\n" +
        "to use the applet %s".format(uuid)), icon);
}

function getProperty(obj, str){
    str += "";
    if(str === "") return obj;
    var res = obj;
    str = str.split(".");
    for(var i = 0, l = str.length; i < l; ++i){
        if(!res[str[i]]) return null;
        res = res[str[i]];
    }
    return res;
}

function setProperty(obj, str, value){
    var res = obj;
    str = (str + "").split(".");
    for(var i = 0, l = str.length - 1; i < l; ++i)
        res = res[str[i]];
    res[str[i]] = value;
}

function Base(settings, colors, time){
    this._init(settings, colors, time);
}

Base.prototype = {
    _init: function(settings, colors, time){
        this.settings = settings;
        this.colors = colors;
        this.time = time;
        this.container = [];
        this.build();
    },

    saveRawPoint: function(name, value){
        setProperty(this.raw, name, value);
    },
    saveDataPoint: function(name, value, raw){
        setProperty(this.data, name, value);

        let history = getProperty(this.history, name);
        if(history){
            history.push(value);
            while(history.length > this.settings.graphSteps + 2)
                history.shift();

            if(this.min !== undefined && (!this.min || this.min > value)){
                this.min = value;
                this.minIndex = history.length;
            }
            if(this.max !== undefined && (!this.max || this.max < value)){
                this.max = value;
                this.maxIndex = history.length;
            }
        }

        if(raw)
            setProperty(this.raw, name, raw);
    },

    updateMinMax: function(){
        if(this.min !== undefined && --this.minIndex <= 0){
            this.min = null;
            this.minIndex = 0;
            for(let i in this.history){
                for(let j = 0, l = this.history[i].length; j < l; ++j){
                    let value = this.history[i][j];
                    if(this.min === null || this.min > value){
                        this.min = value;
                        this.minIndex = j;
                    }
                }
            }
        }

        if(this.max !== undefined && --this.maxIndex <= 0){
            this.max = 1;
            this.maxIndex = 0;
            for(let i in this.history){
                for(let j = 0, l = this.history[i].length; j < l; ++j){
                    let value = this.history[i][j];
                    if(this.max < value){
                        this.max = value;
                        this.maxIndex = j;
                    }
                }
            }
        }
    },

    buildMenuItem: function(name, labels, margin){
        let box = this._makeBox(labels, margin);

        let item = new PopupMenu.PopupMenuItem(name, {reactive: false});
        item.addActor(box);

        if(this.submenu)
            this.submenu.menu.addMenuItem(item);
        return item;
    },
    buildSubMenu: function(labels, margin){
        let box = this._makeBox(labels, margin);

        this.submenu = new PopupMenu.PopupSubMenuMenuItem(this.display);
        this.submenu.addActor(box);
    },

    _makeBox: function(labels, margin){
        let box = new St.BoxLayout({margin_left: margin || 0}), tooltip = false;
        if(!this.submenu){
            tooltip = new St.BoxLayout;
            tooltip.add_actor(new St.Label({text: this.display, width: 85, style: "text-align: left"}));
            this.tooltip = tooltip;
        }

        for(var i = 0, l = labels.length; i < l; ++i){
            box.add_actor(new St.Label({width: labels[i], style: "text-align: right"}));
            if(tooltip){
                let label = new St.Label({width: labels[i] * .75, style: "text-align: right"});
                if(margin && i === 0)
                    label.margin_left = margin * .75;
                tooltip.add_actor(label);
            }
        }

        this.container.push(box);
        return box;
    },

    _update: function(menuOpen){
        this.menuOpen = menuOpen;

        this.update();

        if(this.panel && this.settings[this.name + "PanelLabel"]){
            let text = this.settings[this.name + "PanelLabel"].replace(/%(\w)(\w)/g, bind(this.panelLabelReplace, this));
            this.panel.label.set_text(text);
            this.panel.label.margin_left = text.length? 6 : 0;
        }
        delete this.menuOpen;
    },
    panelLabelReplace: function(match, main, sub){
        if(this.panelLabel[main]){
            let output = this.panelLabel[main].call(this, sub);
            if(output)
                return output;
        } else if(m === "%")
            return main + sub;
        return match;
    },
    setText: function(container, label, format, value, ext){
        value = this.format(format, value, ext);

        if(container === 0)
            this.tooltip.get_children()[label + 1].set_text(value);
        if(this.menuOpen)
            this.container[container].get_children()[label].set_text(value);
    },

    checkWarning: function(value, body, index){
        if(value >= this.settings[this.name + "WarningValue"]){
            var notify = false;
            if(index !== undefined)
                notify = --this.notifications[index] === 0;
            else
                notify = --this.notifications === 0;

            if(notify){
                let value = this.format(this.notificationFormat, this.settings[this.name + "WarningValue"]);
                this.notify("Warning:", body.format(value, this.settings[this.name + "WarningTime"] * this.settings.interval / 1000));
            }
        } else {
            if(index !== undefined)
                this.notifications[index] = this.settings[this.name + "WarningTime"];
            else
                this.notifications = this.settings[this.name + "WarningTime"];
        }
    },
    notify: function(summary, body){
        let source = new MessageTray.SystemNotificationSource();
        messageTray.add(source);

        let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.FULLCOLOR, icon_size: 24});

        let notification = new MessageTray.Notification(source, summary, body, {icon: icon});
        notification.setTransient(true);
        source.notify(notification);
    },

    format: function(format, value, ext){
        value = value || 0;
        if(format === "number")
            return this.formatNumber(value);
        if(format === "rate")
            return this.formatRate(value, ext);
        if(format === "percent")
            return this.formatPercent(value, ext);
        if(format === "thermal")
            return this.formatThermal(value);
        if(format === "bytes")
            return this.formatBytes(value);
        return value;
    },
    formatNumber: function(number){
        return number.toFixed(2);
    },
    formatBytes: function(bytes){
        let prefix = " KMGTPEZY";
        let a = 1, j = 0;
        while(bytes / a > MAXSIZE){
            a *= this.settings.byteUnit? 1024 : 1000;
            ++j;
        }
        return (bytes / a).toFixed(1) + " " + prefix[j] + (this.settings.byteUnit && j? "i" : "") + "B";
    },
    formatRate: function(bytes, dir){
        let prefix = " KMGTPEZY";
        let a = (this.settings.rateUnit < 2? 1 : .125), j = 0;
        while(bytes / a > MAXSIZE){
            a *= this.settings.rateUnit & 1? 1024 : 1000;
            ++j;
        }
        return (bytes / a).toFixed(1) + " " + prefix[j] + (this.settings.rateUnit & 1 && j? "i" : "") + (this.settings.rateUnit < 2? "B" : "bit") + "/s " + (dir? "\u25B2" : "\u25BC");
    },
    formatPercent: function(part, total){
        return (100 * part / (total || 1)).toFixed(1) + "%";
    },
    formatThermal: function(celsius){
        let number = this.settings.thermalUnit? celsius : celsius * 1.8 + 32;
        let unit = this.settings.thermalUnit? "\u2103" : "\u2109"; //2103: Celsius, 2109: Fahrenheit
        return number.toFixed(1) + unit;
    },

    onSettingsChanged: function(){
        if(this.unavailable)
            this.settings[this.name] = false;

        if(this.submenu){
            this.submenu.actor.visible = !!this.settings[this.name];
            this.tooltip.visible = !!this.settings[this.name];
        }

        if(this.panel){
            this.panel.label.visible = this.settings[this.name] && this.settings[this.name + "PanelLabel"] !== "";

            this.panel.canvas.width = this.settings[this.name + "PanelWidth"];
            this.panel.canvas.visible = this.settings[this.name] && this.settings[this.name + "PanelGraph"] !== -1;

            this.panel.box.visible = this.panel.label.visible || this.panel.canvas.visible;
        }
    }
};

function LoadAvg(settings, colors, time){
    this._init(settings, colors, time);
}

LoadAvg.prototype = {
    __proto__: Base.prototype,

    name: "load",
    display: _("Load averages"),

    build: function(){
        try {
            this.gtop = new GTop.glibtop_loadavg;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.data = [];

        let labels = [100, 100, 60];
        this.submenu = this.buildMenuItem(this.display, labels);
    },
    getData: function(){
        GTop.glibtop_get_loadavg(this.gtop);

        this.data = this.gtop.loadavg;
    },
    update: function(){
        this.setText(0, 0, "number", this.data[0]);
        this.setText(0, 1, "number", this.data[1]);
        this.setText(0, 2, "number", this.data[2]);
    }
};

function CPU(settings, colors, time){
    this._init(settings, colors, time);
}

CPU.prototype = {
    __proto__: Base.prototype,

    name: "cpu",
    display: _("CPU"),

    notificationFormat: "percent",

    build: function(){
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
            this.saveRawPoint("total." + i, this.gtop.xcpu_total[i]);
            this.saveRawPoint("user." + i, this.gtop.xcpu_user[i]);
            this.saveRawPoint("system." + i, this.gtop.xcpu_sys[i]);

            labels.push(60);
        }
        this.buildSubMenu(labels, margin);
        this.buildMenuItem(_("User"), labels, margin);
        this.buildMenuItem(_("System"), labels, margin);
    },
    getData: function(){
        GTop.glibtop_get_cpu(this.gtop);
        var dtotal, duser, dsystem, r = 0;
        for(var i = 0; i < this.count; ++i){
            dtotal = this.gtop.xcpu_total[i] - this.raw.total[i];
            duser = this.gtop.xcpu_user[i] - this.raw.user[i];
            dsystem = this.gtop.xcpu_sys[i] - this.raw.system[i];

            this.saveRawPoint("total." + i, this.gtop.xcpu_total[i]);
            this.saveDataPoint("user." + i, duser / dtotal, this.gtop.xcpu_user[i]);
            this.saveDataPoint("system." + i, dsystem / dtotal, this.gtop.xcpu_sys[i]);
            this.saveDataPoint("usage." + i, (duser + dsystem) / dtotal);

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
    },

    menuGraph: "CPUHistory",
    panelGraphs: ["CPUBar", "CPUHistory"]
};


function Memory(settings, colors, time){
    this._init(settings, colors, time);
}

Memory.prototype = {
    __proto__: Base.prototype,

    name: "mem",
    display: _("Memory"),

    build: function(){
        try {
            this.gtop = new GTop.glibtop_mem;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.data = {
            total: 1,
            used: 0,
            usedup: 0,
            cached: 0,
            buffer: 0
        };
        this.history = {
            usedup: [],
            cached: [],
            buffer: []
        };

        let labels = [100, 100, 60];
        this.buildSubMenu(labels);
        this.buildMenuItem(_("used"), labels);
        this.buildMenuItem(_("cached"), labels);
        this.buildMenuItem(_("buffered"), labels);
    },
    getData: function(){
        GTop.glibtop_get_mem(this.gtop);

        this.saveDataPoint("total", this.gtop.total);
        this.saveDataPoint("used", this.gtop.used);
        this.saveDataPoint("usedup", this.gtop.used - this.gtop.cached - this.gtop.buffer);
        this.saveDataPoint("cached", this.gtop.cached);
        this.saveDataPoint("buffer", this.gtop.buffer);
    },
    update: function(){
        this.setText(0, 0, "bytes", this.data.used);
        this.setText(0, 1, "bytes", this.data.total);
        this.setText(0, 2, "percent", this.data.used, this.data.total);

        this.setText(1, 0, "bytes", this.data.usedup);
        this.setText(1, 2, "percent", this.data.usedup, this.data.total);

        this.setText(2, 0, "bytes", this.data.cached);
        this.setText(2, 2, "percent", this.data.cached, this.data.total);

        this.setText(3, 0, "bytes", this.data.buffer);
        this.setText(3, 2, "percent", this.data.buffer, this.data.total);
    },
    panelLabel: {
        _mem: {
            u: "usedup",
            U: "used",
            c: "cached",
            b: "buffer",
            t: "total"
        },
        _swap: {
            u: "used",
            t: "total"
        },

        m: function(n){
            if(this.panelLabel._mem[n])
                return this.format("bytes", this.data[this.panelLabel._mem[n]]);
            return false;
        },
        s: function(n){
            if(n === "p")
                return this.format("percent", this.swap.data.used, this.swap.data.total);
            if(this.panelLabel._swap[n])
                return this.format("bytes", this.swap.data[this.panelLabel._swap[n]]);
            return false;
        },
        p: function(n){
            if(this.panelLabel._mem[n])
                return this.format("percent", this.data[this.panelLabel._mem[n]], this.data.total);
            return false;
        }
    },

    menuGraph: "MemorySwapHistory",
    panelGraphs: ["MemoryBar", "MemoryHistory", "MemorySwapBar", "MemorySwapHistory"]
};


function Swap(settings, colors, time){
    this._init(settings, colors, time);
}

Swap.prototype = {
    __proto__: Base.prototype,

    name: "mem",
    display: _("Swap"),

    build: function(){
        try {
            this.gtop = new GTop.glibtop_swap;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.data = {
            total: 1,
            used: 0
        };
        this.history = {
            used: []
        };

        let labels = [100, 100, 60];
        this.submenu = this.buildMenuItem(this.display, labels);
    },
    getData: function(){
        GTop.glibtop_get_swap(this.gtop);

        this.saveDataPoint("total", this.gtop.total);
        this.saveDataPoint("used", this.gtop.used);
    },
    update: function(){
        this.setText(0, 0, "bytes", this.data.used);
        this.setText(0, 1, "bytes", this.data.total);
        this.setText(0, 2, "percent", this.data.used, this.data.total);
    },

    //will handled by Memory
    onSettingsChanged: function(){}
};


function Disk(settings, colors, time){
    this._init(settings, colors, time);
}

Disk.prototype = {
    __proto__: Base.prototype,

    name: "disk",
    display: _("Disk"),

    max: 1,
    maxIndex: 0,

    build: function(){
        try {
            this.gtop = new GTop.glibtop_fsusage;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.raw = {
            write: 0,
            read: 0
        };
        this.data = {
            write: 0,
            read: 0
        };
        this.history = {
            write: [],
            read: []
        };

        this.buildSubMenu([130, 130]);

        this._updateDevices();
    },
    _updateDevices: function(){
        this.container.splice(1, this.container.length - 1);
        this.submenu.menu.removeAll();
        this.dev = [];

        let mountFile = Cinnamon.get_file_contents_utf8_sync("/etc/mtab").split("\n");
        for(let mountLine in mountFile){
            let mount = mountFile[mountLine].split(" ");
            if(mount[0].indexOf("/dev/") === 0){
                GTop.glibtop_get_fsusage(this.gtop, mount[1]);
                this.dev.push({
                    path: mount[1],
                    size: this.gtop.block_size,
                    free: this.gtop.bfree,
                    blocks: this.gtop.blocks
                });
                this.buildMenuItem(mount[1], [100, 100, 60]);
            }
        }
        Mainloop.timeout_add(30000, bind(this._updateDevices, this));
    },
    getData: function(delta){
        let write = 0, read = 0;
        for(var i = 0; i < this.dev.length; ++i){
            GTop.glibtop_get_fsusage(this.gtop, this.dev[i].path);

            this.dev[i].size = this.gtop.block_size;
            this.dev[i].free = this.gtop.bfree;
            this.dev[i].blocks = this.gtop.blocks;

            write += this.gtop.write * this.dev[i].size;
            read += this.gtop.read * this.dev[i].size;
        }

        if(delta > 0 && this.raw.write && this.raw.read){
            this.saveDataPoint("write", (write - this.raw.write) / delta);
            this.saveDataPoint("read", (read - this.raw.read) / delta);

            this.updateMinMax();
        }

        this.saveRawPoint("write", write);
        this.saveRawPoint("read", read);
    },
    update: function(){
        this.setText(0, this.settings.order? 0 : 1, "rate", this.data.write, true);
        this.setText(0, this.settings.order? 1 : 0, "rate", this.data.read, false);

        for(var i = 0; i < this.dev.length; ++i){
            this.setText(i + 1, 0, "bytes", (this.dev[i].blocks - this.dev[i].free) * this.dev[i].size);
            this.setText(i + 1, 1, "bytes", this.dev[i].blocks * this.dev[i].size);
            this.setText(i + 1, 2, "percent", this.dev[i].blocks - this.dev[i].free, this.dev[i].blocks);
        }
    },
    panelLabel: {
        r: function(n){
            if(n === "w")
                return this.format("rate", this.data.write, true);
            if(n === "r")
                return this.format("rate", this.data.read, false);
            return false;
        }
    },

    menuGraph: "DiskHistory",
    panelGraphs: ["DiskBar", "DiskHistory"]
};


function Network(settings, colors, time){
    this._init(settings, colors, time);
}

Network.prototype = {
    __proto__: Base.prototype,

    name: "network",
    display: _("Network"),

    max: 1,
    maxIndex: 0,

    build: function(){
        try {
            this.gtop = new GTop.glibtop_netload;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.raw = {
            up: [],
            down: []
        };
        this.data = {
            up: [],
            down: []
        };
        this.history = {
            up: [],
            down: []
        };

        this.dev = [];

        let labels = [130, 130];
        this.buildSubMenu(labels);
        let r = Cinnamon.get_file_contents_utf8_sync("/proc/net/dev").split("\n"), s;
        for(var i = 2, l = r.length; i < l; ++i){
            s = r[i].match(/^\s*(\w+)/);
            if(s !== null){
                s = s[1];
                if(s === "lo") continue;
                this.dev.push(s);
            }
        }
        this.buildMenuItem(_("Total"), labels);
    },
    getData: function(delta){
        let up = 0, down = 0;
        for(var i = 0, l = this.dev.length; i < l; ++i){
            GTop.glibtop_get_netload(this.gtop, this.dev[i]);
            up += this.gtop.bytes_out;
            down += this.gtop.bytes_in;
        }

        if(delta > 0 && this.raw.up > -1 && this.raw.down > -1){
            this.saveDataPoint("up", this.raw.up? (up - this.raw.up) / delta : 0);
            this.saveDataPoint("down", this.raw.down? (down - this.raw.down) / delta : 0);

            this.updateMinMax();
        }

        this.saveRawPoint("up", up);
        this.saveRawPoint("down", down);
    },
    update: function(){
        this.setText(0, this.settings.order? 0 : 1, "rate", this.data.up, true);
        this.setText(0, this.settings.order? 1 : 0, "rate", this.data.down, false);

        this.setText(1, this.settings.order? 0 : 1, "bytes", this.raw.up);
        this.setText(1, this.settings.order? 1 : 0, "bytes", this.raw.down);
    },
    panelLabel: {
        r: function(n){
            if(n === "u")
                return this.format("rate", this.data.up, true);
            if(n === "d")
                return this.format("rate", this.data.down, false);
            return false;
        }
    },

    menuGraph: "NetworkHistory",
    panelGraphs: ["NetworkBar", "NetworkHistory"]
};


function Thermal(settings, colors, time){
    this._init(settings, colors, time);
}

Thermal.prototype = {
    __proto__: Base.prototype,

    name: "thermal",
    display: _("Thermal"),

    sensors: [],
    colorRef: [],
    path: "",

    min: null,
    max: null,

    notificationFormat: "thermal",

    build: function(){
        this.data = [];
        this.history = [[]];

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
            this.saveDataPoint(i + 1, parseFloat(result[this.sensors[i]].match(/\d+\.\d+/)));

            if(this.settings.thermalMode === 0 && temp > this.data[i + 1] || temp === 0) temp = this.data[i + 1];
            else if(this.settings.thermalMode === 1) temp += this.data[i + 1];
            else if(this.settings.thermalMode === 2 && temp < this.data[i + 1]) temp = this.data[i + 1];
        }
        if(this.settings.thermalMode === 1) temp /= l;
        this.saveDataPoint("0", temp);
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
            if(!this.settings.thermalUnit) this.settings.thermalWarningValue = (this.settings.thermalWarningValue - 32) * 5 / 9; //Fahrenheit => Celsius
        }
    },

    menuGraph: "ThermalHistory",
    panelGraphs: ["ThermalBar", "ThermalHistory"]
};
