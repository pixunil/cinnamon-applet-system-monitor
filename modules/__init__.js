const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;

const messageTray = Main.messageTray;

const uuid = imports.uuid;
const iconName = imports.iconName;

const _ = imports._;
const bind = imports.bind;

const MAXSIZE = 1500;

try {
    const GTop = imports.gi.GTop;
} catch(e){
    let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.FULLCOLOR, icon_size: 24});
    Main.criticalNotify(_("Dependence missing"), _("Please install the GTop package\n" +
        "\tUbuntu / Mint: gir1.2-gtop-2.0\n" +
        "\tFedora: libgtop2-devel\n" +
        "\tArch: libgtop\n" +
        "to use the applet %s").format(uuid), icon);
}

function Base(){
    throw new TypeError("Trying to instantiate abstract class [" + uuid + "] modules.Base");
}

Base.prototype = {
    init: function(settings, colors, time){
        this.settings = settings;
        this.colors = colors;
        this.time = time;

        this.container = [];

        this.import = imports.modules[this.name];
    },

    buildPanelWidget: function(){
        if(this.import.HistoryGraph){
            this.panel = new PanelWidget(this);
            return this.panel;
        }

        return null;
    },

    saveRaw: function(name, value){
        this.raw[name] = value;
    },

    saveData: function(name, value){
        this.data[name] = value;

        this.updateHistory(this.history[name], value);
    },

    updateHistory: function(history, value){
        if(!history)
            return;

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
        let box = this.makeBox(labels, margin);

        let item = new PopupMenu.PopupMenuItem(name, {reactive: false});
        item.addActor(box);

        if(this.submenu)
            this.submenu.menu.addMenuItem(item);
        return item;
    },

    buildSubMenu: function(labels, margin){
        let box = this.makeBox(labels, margin);

        this.submenu = new PopupMenu.PopupSubMenuMenuItem(this.display);
        this.submenu.addActor(box);
    },

    makeBox: function(labels, margin){
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

    getSetting: function(value){
        return this.settings[(this.settingsName || this.name) + value];
    },

    doUpdate: function(menuOpen){
        if(!this.getSetting(""))
            return;

        this.menuOpen = menuOpen;

        this.update();

        if(this.panel && this.getSetting("PanelLabel")){
            let text = this.getSetting("PanelLabel").replace(/%(\w)(\w)/g, bind(this.panelLabelReplace, this));
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

function PanelWidget(){
    this.init.apply(this, arguments);
}

PanelWidget.prototype = {
    init: function(module){
        this.box = new St.BoxLayout;

        this.label = new St.Label({reactive: true, track_hover: true, style_class: "applet-label"});
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.box.add(this.label, {y_align: St.Align.MIDDLE, y_fill: false});

        this.canvas = new St.DrawingArea;
        this.canvas.connect("repaint", bind(this.draw, this));
        this.box.add(this.canvas);

        this.graphs = [
            new module.import.BarGraph(this.canvas, module, module.settings, module.colors),
            new module.import.HistoryGraph(this.canvas, module, module.time, module.settings, module.colors)
        ];

        // inform the history graph that a horizontal packing is now required
        this.graphs[1].packDir = false;

        this.module = module;
        this.settings = module.settings;
    },

    draw: function(){
        let graph = this.settings[this.module.name + "PanelGraph"];

        if(this.settings[this.module.name + "PanelGraph"] === -1)
            return;

        this.graphs[graph].draw();
    },

    paint: function(){
        this.canvas.queue_repaint();
    }
};
