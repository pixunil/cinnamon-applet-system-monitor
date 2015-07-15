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

let GTop = null;

try {
    GTop = imports.gi.GTop;
} catch(e){
    let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.FULLCOLOR, icon_size: 24});
    Main.criticalNotify(_("Dependence missing"), _("Please install the GTop package\n" +
        "\tUbuntu / Mint: gir1.2-gtop-2.0\n" +
        "\tFedora: libgtop2-devel\n" +
        "\tArch: libgtop\n" +
        "to use the applet %s").format(uuid), icon);
}

const ModulePartPrototype = {
    init: function(module){
        this.module = module;
    },

    getSetting: function(value){
        return this.module.settings[(this.module.settingsName || this.module.name) + value];
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
        let size = 1;
        let sizeMultiplicator = this.settings.byteUnit === "binary"? 1024 : 1000;
        let prefixIndex = 0;

        while(bytes / size > MAXSIZE){
            size *= sizeMultiplicator;
            ++prefixIndex;
        }

        let number = (bytes / size).toFixed(1);
        let unit = prefix[prefixIndex] + (this.settings.byteUnit === "binary" && prefixIndex? "i" : "") + "B";
        return number + " " + unit;
    },

    formatRate: function(bytes, dir){
        let prefix = " KMGTPEZY";
        let size = this.settings.rateUnit.endsWith("byte")? 1 : .125;
        let sizeMultiplicator = this.settings.rateUnit.startsWith("binary")? 1024 : 1000;
        let prefixIndex = 0;

        while(bytes / size > MAXSIZE){
            size *= sizeMultiplicator;
            ++prefixIndex;
        }

        let number = (bytes / size).toFixed(1);
        let unit = prefix[prefixIndex] + (this.settings.rateUnit.startsWith("binary") && prefixIndex? "i" : "") + (this.settings.rateUnit.endsWith("byte")? "B" : "bit") + "/s";
        let arrow = dir? "\u25B2" : "\u25BC";
        return number + " " + unit + " " + arrow;
    },

    formatPercent: function(part, total){
        return (100 * part / (total || 1)).toFixed(1) + "%";
    },

    formatThermal: function(celsius){
        let number = this.settings.thermalUnit? celsius : celsius * 1.8 + 32;
        let unit = this.settings.thermalUnit === "celsius"? "\u2103" : "\u2109"; //2103: Celsius, 2109: Fahrenheit
        return number.toFixed(1) + unit;
    },

    // shortcuts
    get name(){
        return this.module.name;
    },

    get settings(){
        return this.module.settings;
    },

    get modules(){
        return this.module.modules;
    },

    get time(){
        return this.module.time;
    },

    get raw(){
        return this.module.dataProvider.raw;
    },

    get data(){
        return this.module.dataProvider.data;
    },

    get history(){
        return this.module.dataProvider.history;
    },

    get count(){
        return this.module.dataProvider.count;
    },

    get dev(){
        return this.module.dataProvider.dev;
    },

    get colorRefs(){
        return this.module.dataProvider.colorRefs;
    }
};

function ModulePart(superClass){
    var proto = Object.create(superClass.prototype);

    for(let property in ModulePartPrototype)
        Object.defineProperty(proto, property, Object.getOwnPropertyDescriptor(ModulePartPrototype, property));

    return proto;
}

function Module(){
    this.init.apply(this, arguments);
}

Module.prototype = {
    init: function(imports, settings, time){
        this.import = imports;
        this.name = imports.name;
        this.settingsName = imports.settingsName;
        this.display = imports.display;

        if(!this.settingsName){
            this.settingKeys = [this.name];

            if(imports.additionalSettingKeys)
                this.settingKeys = this.settingKeys.concat(imports.additionalSettingKeys.map(key => this.name + "-" + key));

            if(imports.HistoryGraph)
                this.settingKeys.push(this.name + "-appearance", this.name + "-panel-graph", this.name + "-panel-width");

            if(imports.PanelLabel)
                this.settingKeys.push(this.name + "-panel-label");

            if(imports.colorSettingKeys){
                this.colorSettingKeys = imports.colorSettingKeys;
                this.settingKeys = this.settingKeys.concat(this.colorSettingKeys.map(key => this.name + "-color-" + key));
            }
        }

        this.module = this;

        this.settings = settings;
        this.time = time;

        this.dataProvider = new imports.DataProvider(this);

        if(this.dataProvider.unavailable){
            this.unavailable = true;
            return;
        }

        this.menuItem = new imports.MenuItem(this);
        this.tooltip = this.menuItem.makeTooltip();

        if(imports.PanelLabel || imports.BarGraph)
            this.panelWidget = new PanelWidget(this);
    },

    buildMenuGraph: function(applet, index){
        if(!this.import.HistoryGraph)
            return null;

        this.graphMenuItem = new GraphMenuItem(applet, this.import.historyGraphDisplay, index);
        return new this.import.HistoryGraph(applet.canvas, this);
    },

    getSetting: ModulePartPrototype.getSetting,

    get min(){
        return this.dataProvider.min || 0;
    },

    get max(){
        return this.dataProvider.max || 1;
    },

    getData: function(delta){
        if(this.getSetting(""))
            this.dataProvider.getData(delta);
    },

    update: function(){
        if(this.getSetting("")){
            this.menuItem.update();

            if(this.panelWidget)
                this.panelWidget.update();
        }
    },

    onSettingsChanged: function(){
        if(this.dataProvider.unavailable)
            this.settings[this.name] = false;

        this.color = {};

        if(this.colorSettingKeys){
            this.colorSettingKeys.forEach(function(key){
                let color = this.getSetting("Color" + key[0].toUpperCase() + key.substr(1));
                color = color.match(/(\d+), (\d+), (\d+)/); // get the values of red, green and blue
                color.shift(); // remove the match index
                color = color.map(colorPart => parseInt(colorPart) / 255); // make the color parts to be integers in the range 0 to 1

                this.color[key] = color;
            }, this);
        }

        if(this.dataProvider.onSettingsChanged)
            this.dataProvider.onSettingsChanged();

        if(this.menuItem)
            this.menuItem.onSettingsChanged();
        if(this.panelWidget)
            this.panelWidget.onSettingsChanged();
        if(this.graphMenuItem)
            this.graphMenuItem.onSettingsChanged(this.getSetting(""));
    }
};

function BaseDataProvider(){
    throw new TypeError("Trying to instantiate abstract class [" + uuid + "] modules.BaseDataProvider");
}

BaseDataProvider.prototype = {
    init: function(module){
        this.module = module;
        this.time = module.time;
        this.settings = module.settings;
    },

    getSetting: ModulePartPrototype.getSetting,
    format: ModulePartPrototype.format,
    formatPercent: ModulePartPrototype.formatPercent,
    formatThermal: ModulePartPrototype.formatThermal,

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

    checkWarning: function(value, body, index){
        if(value >= this.getSetting("WarningValue")){
            var notify = false;
            if(index !== undefined)
                notify = --this.notifications[index] === 0;
            else
                notify = --this.notifications === 0;

            if(notify){
                let value = this.format(this.notificationFormat, this.getSetting("WarningValue"));
                this.notify(_("Warning"), body.format(value, this.getSetting("WarningTime") * this.settings.interval / 1000));
            }
        } else {
            if(index !== undefined)
                this.notifications[index] = this.getSetting("WarningTime");
            else
                this.notifications = this.getSetting("WarningTime");
        }
    },

    notify: function(summary, body){
        let source = new MessageTray.SystemNotificationSource();
        messageTray.add(source);

        let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.FULLCOLOR, icon_size: 24});

        let notification = new MessageTray.Notification(source, summary, body, {icon: icon});
        notification.setTransient(true);
        source.notify(notification);
    }
};

function BaseMenuItem(){
    throw new TypeError("Trying to instantiate abstract class [" + uuid + "] modules.BaseMenuItem");
}

BaseMenuItem.prototype = {
    __proto__: ModulePart(PopupMenu.PopupMenuItem),

    init: function(module){
        PopupMenu.PopupMenuItem.prototype._init.call(this, module.display, {reactive: false});

        this.module = module;
        this.containers = [];

        let box = this.makeBox();
        this.addActor(box);
    },

    makeBox: function(labelWidths, margin, tooltip){
        if(labelWidths === undefined)
            labelWidths = this.labelWidths;

        if(margin === undefined)
            margin = this.margin || 0;

        let box = new St.BoxLayout;
        let container = [];

        if(tooltip)
            box.add_actor(new St.Label({text: this.module.display, width: 85, margin_right: margin, style: "text-align: left"}));
        else
            box.margin_left = margin;

        for(let i = 0, l = labelWidths.length; i < l; ++i){
            let label = new St.Label({width: labelWidths[i], style: "text-align: right"});
            box.add_actor(label);
            container.push(label);
        }

        if(tooltip)
            this.tooltip = container;
        else
            this.containers.push(container);

        return box;
    },

    makeTooltip: function(){
        let labelWidths = this.labelWidths.map(labelWidth => labelWidth * .75);
        let margin = (this.margin || 0) * .75;

        this.tooltipBox = this.makeBox(labelWidths, margin, true);
        return this.tooltipBox;
    },

    setText: function(container, label, format, value, ext){
        value = this.format(format, value, ext);

        if(container === 0)
            this.tooltip[label].text = value;

        this.containers[container][label].text = value;
    },

    onSettingsChanged: function(){
        this.actor.visible = this.getSetting("");
        this.tooltipBox.visible = this.getSetting("");
    }
};

function BaseSubMenuMenuItem(){
    throw new TypeError("Trying to instantiate abstract class [" + uuid + "] modules.BaseSubMenuMenuItem");
}

BaseSubMenuMenuItem.prototype = {
    __proto__: ModulePart(PopupMenu.PopupSubMenuMenuItem),

    init: function(module){
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, module.display);

        this.module = module;
        this.containers = [];

        let box = this.makeBox();
        this.addActor(box);
    },

    makeBox: BaseMenuItem.prototype.makeBox,
    makeTooltip: BaseMenuItem.prototype.makeTooltip,

    addRow: function(label, labels, margin){
        if(labels === undefined)
            labels = this.labels;

        if(margin === undefined)
            margin = this.margin;

        let menuItem = new PopupMenu.PopupMenuItem(label, {reactive: false});
        this.menu.addMenuItem(menuItem);
        let box = this.makeBox(labels, margin);
        menuItem.addActor(box);
    },

    setText: BaseMenuItem.prototype.setText,
    onSettingsChanged: BaseMenuItem.prototype.onSettingsChanged
};

function GraphMenuItem(){
    this.init.apply(this, arguments);
}

GraphMenuItem.prototype = {
    __proto__: PopupMenu.PopupMenuItem.prototype,

    init: function(applet, display, index){
        PopupMenu.PopupMenuItem.prototype._init.call(this, display);

        this.index = index;
        this.settings = applet.settings;
        this.onGraphTypeChanged = bind(applet.onGraphTypeChanged, applet);
    },

    // overwriting instead of connecting to supress menu from closing
    activate: function(){
        this.settings.graphType = this.index;
        this.onGraphTypeChanged();
    },

    onSettingsChanged: function(active){
        this.actor.visible = active;

        // if the module was deactivated, but the menu graph is active, set it to "Overview"
        if(!active && this.settings.graphType === this.index){
            this.settings.graphType = 0;
            this.onGraphTypeChanged();
        }
    }
};

function PanelWidget(){
    this.init.apply(this, arguments);
}

PanelWidget.prototype = {
    __proto__: ModulePartPrototype,

    init: function(module){
        this.module = module;

        this.box = new St.BoxLayout;

        if(module.import.PanelLabel){
            this.label = new St.Label({reactive: true, track_hover: true, style_class: "applet-label"});
            this.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this.box.add(this.label, {y_align: St.Align.MIDDLE, y_fill: false});

            this.panelLabel = new module.import.PanelLabel(module);
        }

        if(module.import.BarGraph){
            this.canvas = new St.DrawingArea;
            this.canvas.connect("repaint", bind(this.draw, this));
            this.box.add(this.canvas);

            this.graphs = [
                new module.import.BarGraph(this.canvas, module),
                new module.import.HistoryGraph(this.canvas, module)
            ];

            // inform the history graph that a horizontal packing is now required
            this.graphs[1].packDir = "horizontal";
        }
    },

    update: function(){
        if(this.getSetting("PanelLabel") && this.label){
            let text = this.getSetting("PanelLabel").replace(/%(\w)(\w)/g, bind(this.panelLabelReplace, this));
            this.label.set_text(text);
            this.label.margin_left = text.length? 6 : 0;
        }
    },

    panelLabelReplace: function(match, main, sub){
        if(this.panelLabel[main]){
            let output = this.panelLabel[main](sub);

            if(output)
                return output;
        } else if(main === "%")
            return main + sub;

        return match;
    },

    draw: function(){
        let graph = this.getSetting("PanelGraph");

        if(graph === -1)
            return;

        graph = this.graphs[graph];

        if(this.getSetting("PanelMode") !== undefined)
            graph.mode = this.getSetting("PanelMode");

        graph.draw();
        graph.ctx.$dispose();
    },

    paint: function(){
        if(this.canvas)
            this.canvas.queue_repaint();
    },

    onSettingsChanged: function(){
        let showBox = false;

        if(this.label){
            let show = this.getSetting("") && this.getSetting("PanelLabel") !== "";
            this.label.visible = show;
            showBox = show;
        }

        if(this.canvas){
            this.canvas.width = this.getSetting("PanelWidth");
            let show = this.getSetting("") && this.getSetting("PanelGraph") !== -1;
            this.canvas.visible = show;
            this.canvas.margin_left = show? 6 : 0;

            showBox = showBox || show;
        }

        this.box.visible = showBox;
    }
};
