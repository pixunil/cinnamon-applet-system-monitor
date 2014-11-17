const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;

const messageTray = Main.messageTray;

const uuid = "system-monitor@pixunil";
const iconName = "utilities-system-monitor";

try {
	const GTop = imports.gi.GTop;
} catch(e){
	let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.FULLCOLOR, icon_size: 24});
	Main.criticalNotify(_("Dependence missing"), _("Please install the GTop package\n" +
		"\tUbuntu / Mint: gir1.2-gtop-2.0\n" +
		"\tFedora: libgtop2-devel\n" +
		"\tArch: libgtop\n" +
		"to use the applet " + uuid), icon);
}

const Terminal = imports.ui.appletManager.applets[uuid].terminal;
const Graph = imports.ui.appletManager.applets[uuid].graph;


function PanelWidget(panelHeight, modules, settings, colors, name){
	this._init(panelHeight, modules, settings, colors, name);
}
PanelWidget.prototype = {
	_init: function(panelHeight, modules, settings, colors, name){
		this.name = name;
		this.canvas = new St.DrawingArea({width: settings["panel" + name + "Width"], height: panelHeight, margin_left: 2});
		this.canvas.connect("repaint", this.draw.bind(this));
		if(settings["panel" + name + "Graph"] === -1)
			this.canvas.hide();
		this.graphs = [];

		this.modules = modules;
		this.settings = settings;
		this.colors = colors;
	},
	update: function(){
		this.canvas.set_width(this.settings["panel" + this.name + "Width"]);
		if(this.settings["panel" + this.name + "Graph"] !== -1)
			this.canvas.show();
		else
			this.canvas.hide();
	},
	addGraph: function(graphClass){
		let graph = new graphClass(this.canvas, this.modules, this.settings, this.colors);
		graph.packDir = false;
		this.graphs.push(graph);
	},
	draw: function(){
		let graph = this.settings["panel" + this.name + "Graph"];
		if(this.settings["panel" + this.name + "Mode"])
			graph += this.settings["panel" + this.name + "Mode"];
		this.graphs[graph].draw();
	},
	paint: function(){
		this.canvas.queue_repaint();
	}
};


function SystemMonitorApplet(orientation, panelHeight, instanceId){
	this._init(orientation, panelHeight, instanceId);
}
SystemMonitorApplet.prototype = {
	__proto__: Applet.Applet.prototype,

	cpu: {
		gtop: new GTop.glibtop_cpu(),

		raw: {
			total: [],
			user: [],
			system: []
		},
		data: {
			usage: [],
			user: [],
			system: []
		},
		history: {
			user: [],
			system: []
		},

		count: GTop.glibtop_get_sysinfo().ncpu,

		submenu: new PopupMenu.PopupSubMenuMenuItem(_("CPU")),
		container: [new St.BoxLayout()]
	},
	mem: {
		gtop: new GTop.glibtop_mem(),

		data: {},
		history: {
			usedup: [],
			cached: [],
			buffer: []
		},

		submenu: new PopupMenu.PopupSubMenuMenuItem(_("Memory")),
		container: [new St.BoxLayout()]
	},
	swap: {
		gtop: new GTop.glibtop_swap(),

		data: {},
		history: [],

		submenu: new PopupMenu.PopupMenuItem(_("Swap"), {reactive: false}),
		container: [new St.BoxLayout()]
	},
	disk: {
		gtop: new GTop.glibtop_fsusage(),

		raw: {
			write: null,
			read: null
		},
		data: {
			write: null,
			read: null
		},
		history: {
			write: [],
			read: []
		},
		dev: [],

		max: 1,
		maxIndex: 0,

		submenu: new PopupMenu.PopupSubMenuMenuItem(_("Disk")),
		container: [new St.BoxLayout()]
	},
	network: {
		gtop: new GTop.glibtop_netload(),

		raw: {
			up: [],
			down: []
		},
		data: {
			up: [],
			down: []
		},
		history: {
			up: [],
			down: []
		},
		dev: {},

		max: 1,
		maxIndex: 0,

		submenu: new PopupMenu.PopupSubMenuMenuItem(_("Network")),
		menuitem: [],
		container: [new St.BoxLayout()]
	},
	thermal: {
		sensors: [],
		colors: [],
		path: "",

		data: [],
		history: [[]],

		min: null,
		max: null,

		submenu: new PopupMenu.PopupSubMenuMenuItem(_("Thermal")),
		container: [new St.BoxLayout()]
	},

	time: [],

	graph: {
		submenu: new PopupMenu.PopupSubMenuMenuItem(_("Graph")),
		items: [new PopupMenu.PopupMenuItem(_("Pie")), new PopupMenu.PopupMenuItem(_("Arc")), new PopupMenu.PopupMenuItem(_("CPU History")), new PopupMenu.PopupMenuItem(_("Memory History")),
			new PopupMenu.PopupMenuItem(_("Disk History")), new PopupMenu.PopupMenuItem(_("Network History")), new PopupMenu.PopupMenuItem(_("Thermal History"))]
	},
	graphs: [],

	_init: function(orientation, panelHeight, instanceId){
		try {
			Applet.Applet.prototype._init.call(this, orientation, panelHeight);

			this.panelHeight = panelHeight;

			let item, i, l, j, r, s, t, _appSys = Cinnamon.AppSystem.get_default();

			this.modules = {
				cpu: this.cpu,
				mem: this.mem,
				swap: this.swap,
				disk: this.disk,
				network: this.network,
				thermal: this.thermal,
				time: this.time
			};
			this.settings = {};
			this.colors = {};
			this.notifications = {};
			this.settingProvider = new Settings.AppletSettings(this.settings, uuid, instanceId);
			["interval", "byte-unit", "rate-unit", "maxsize", "order",
				"graph-appearance", "graph-connection", "graph-interval", "graph-steps"].forEach(function(p){
				var q = p.replace(/-(.)/g, function(m, c){
					return c.toUpperCase();
				});

				this.settingProvider.bindProperty(Settings.BindingDirection.IN, p, q);
			}, this);

			this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "thermal-mode", "thermalMode");

			//Settings with callback
			["thermal-unit", "graph-size", "thermal", "write", "read", "cpu1", "cpu2", "cpu3", "cpu4", "mem", "swap",
				"cpu-warning", "cpu-warning-time", "cpu-warning-mode", "cpu-warning-value", "thermal-warning", "thermal-warning-time", "thermal-warning-value"].forEach(function(p){
				var q = p.replace(/-(.)/g, function(m, c){
					return c.toUpperCase();
				});

				this.settingProvider.bindProperty(Settings.BindingDirection.IN, p, q, this.onSettingsChanged.bind(this));
			}, this);

			this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "graph-type", "graphType", this.onGraphTypeChanged.bind(this));

			//Panel settings
			["cpu", "mem", "disk", "network", "thermal"].forEach(function(p){
				var q = p[0].toUpperCase() + p.substr(1);

				this.settingProvider.bindProperty(Settings.BindingDirection.IN, "panel-" + p + "-graph", "panel" + q + "Graph", this.updatePanelWidgets.bind(this));
				this.settingProvider.bindProperty(Settings.BindingDirection.IN, "panel-" + p + "-width", "panel" + q + "Width", this.updatePanelWidgets.bind(this));
			}, this);
			this.settingProvider.bindProperty(Settings.BindingDirection.IN, "panel-mem-mode", "panelMemMode", this.updatePanelWidgets.bind(this));

			this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this.menuManager.addMenu(this.menu);

			for(i = 0; i < this.cpu.count; ++i){
				this.cpu.raw.total.push(0);
				this.cpu.raw.user.push(0);
				this.cpu.raw.system.push(0);

				this.cpu.history.user.push([]);
				this.cpu.history.system.push([]);

				this.cpu.container[0].add_actor(new St.Label({width: 60, style: "text-align: right"}));
			}
			this.cpu.container[0].set_margin_left(260 - this.cpu.count * 60);
			this.cpu.submenu.addActor(this.cpu.container[0]);
			r = ["User", "System"];
			for(i = 0, l = r.length; i < l; ++i){
				item = new PopupMenu.PopupMenuItem(_(r[i]), {reactive: false});
				this.cpu.container.push(new St.BoxLayout({margin_left: 260 - this.cpu.count * 60}));
				for(j = 0; j < this.cpu.count; ++j)
					this.cpu.container[i + 1].add_actor(new St.Label({width: 60, style: "text-align: right"}));
				item.addActor(this.cpu.container[i + 1]);
				this.cpu.submenu.menu.addMenuItem(item);
			}
			this.menu.addMenuItem(this.cpu.submenu);

			this.mem.container[0].add_actor(new St.Label({width: 100, style: "text-align: right"}));
			this.mem.container[0].add_actor(new St.Label({width: 100, style: "text-align: right"}));
			this.mem.container[0].add_actor(new St.Label({width: 60, style: "text-align: right"}));
			this.mem.submenu.addActor(this.mem.container[0]);
			r = ["used", "cached", "buffered"];
			for(i = 0, l = r.length; i < l; ++i){
				item = new PopupMenu.PopupMenuItem(_(r[i]), {reactive: false});
				this.mem.container.push(new St.BoxLayout());
				this.mem.container[i + 1].add_actor(new St.Label({width: 100, style: "text-align: right"}));
				this.mem.container[i + 1].add_actor(new St.Label({width: 60, style: "text-align: right", margin_left: 100}));
				item.addActor(this.mem.container[i + 1]);
				this.mem.submenu.menu.addMenuItem(item);
			}
			this.menu.addMenuItem(this.mem.submenu);

			this.swap.container[0].add_actor(new St.Label({width: 100, style: "text-align: right"}));
			this.swap.container[0].add_actor(new St.Label({width: 100, style: "text-align: right"}));
			this.swap.container[0].add_actor(new St.Label({width: 60, style: "text-align: right"}));
			this.swap.submenu.addActor(this.swap.container[0]);
			this.menu.addMenuItem(this.swap.submenu);

			this.disk.container[0].add_actor(new St.Label({width: 130, style: "text-align: right"}));
			this.disk.container[0].add_actor(new St.Label({width: 130, style: "text-align: right"}));
			this.disk.submenu.addActor(this.disk.container[0]);
			let mountFile = Cinnamon.get_file_contents_utf8_sync('/etc/mtab').split("\n");
			i = 0;
			var mount;
			for(let mountLine in mountFile){
				mount = mountFile[mountLine].split(" ");
				if(mount[0].indexOf("/dev/") == 0){
					GTop.glibtop_get_fsusage(this.disk.gtop, mount[1]);
					this.disk.dev.push({
						path: mount[1],
						size: this.disk.gtop.block_size,
						free: this.disk.gtop.bfree,
						blocks: this.disk.gtop.blocks
					});
					item = new PopupMenu.PopupMenuItem(mount[1], {reactive: false});
					this.disk.container.push(new St.BoxLayout());
					this.disk.container[i + 1].add_actor(new St.Label({width: 100, style: "text-align: right"}));
					this.disk.container[i + 1].add_actor(new St.Label({width: 100, style: "text-align: right"}));
					this.disk.container[i + 1].add_actor(new St.Label({width: 60, style: "text-align: right"}));
					item.addActor(this.disk.container[i + 1]);
					this.disk.submenu.menu.addMenuItem(item);
					++i;
				}
			}
			GTop.glibtop_get_fsusage(this.disk.gtop, "/");
			this.menu.addMenuItem(this.disk.submenu);

			this.network.container[0].add_actor(new St.Label({width: 130, style: "text-align: right"}));
			this.network.container[0].add_actor(new St.Label({width: 130, style: "text-align: right"}));
			this.network.submenu.addActor(this.network.container[0]);
			this.network.dev = {};
			r = Cinnamon.get_file_contents_utf8_sync('/proc/net/dev').split("\n");
			for(i = 2, j = 0, l = r.length; i < l; ++i){
				s = r[i].match(/^\s*(\w+)/);
				if(s !== null){
					s = s[1];
					if(s == "lo") continue;
					this.network.dev[s] = [];
					this.network.menuitem.push(item = new PopupMenu.PopupMenuItem(s, {reactive: false}));
					this.network.container.push(new St.BoxLayout());
					this.network.container[j + 1].add_actor(new St.Label({width: 130, style: "text-align: right"}));
					this.network.container[j + 1].add_actor(new St.Label({width: 130, style: "text-align: right"}));
					item.addActor(this.network.container[j + 1]);
					this.network.submenu.menu.addMenuItem(item);
					++j;
				}
			}
			this.network.submenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			this.network.menuitem.push(item = new PopupMenu.PopupMenuItem("Total", {reactive: false}));
			this.network.container.push(new St.BoxLayout());
			this.network.container[j + 1].add_actor(new St.Label({width: 130, style: "text-align: right"}));
			this.network.container[j + 1].add_actor(new St.Label({width: 130, style: "text-align: right"}));
			item.addActor(this.network.container[j + 1]);
			this.network.submenu.menu.addMenuItem(item);
			this.menu.addMenuItem(this.network.submenu);

			this.thermal.container[0].add_actor(new St.Label({width: 80, style: "text-align: right", margin_left: 180}));
			this.thermal.submenu.addActor(this.thermal.container[0]);
			r = GLib.spawn_command_line_sync("which sensors");
			if(r[0] && r[3] == 0){
				this.thermal.path = r[1].toString().split("\n", 1)[0];
				r = GLib.spawn_command_line_sync(this.thermal.path)[1].toString().split("\n");
				for(i = 0, l = r.length; i < l; ++i){
					if(r[i].substr(0, 8) == "Adapter:" && !r[i].match(/virtual/i)){
						s = r[i].substr(9);
						for(++i; r[i] && r[i].substr(0, 8) != "Adapter:"; ++i){
							if(r[i].match(/\d+.\d+\xb0C/)){
								t = r[i].match(/[^:]+/)[0];

								if((j = t.match(/core\s*(\d)/i)) !== null) this.thermal.colors.push(parseInt(j[1]) % 4 + 1);
								else this.thermal.colors.push(null);

								item = new PopupMenu.PopupMenuItem(t, {reactive: false});
								this.thermal.container.push(new St.BoxLayout());
								this.thermal.container[this.thermal.container.length - 1].add_actor(new St.Label({width: 80, style: "text-align: right", margin_left: 180}));
								item.addActor(this.thermal.container[this.thermal.container.length - 1]);
								this.thermal.submenu.menu.addMenuItem(item);
								this.thermal.sensors.push(i);
								this.thermal.history.push([]);
							}
						}
					}
				}
			}
			if(this.thermal.sensors.length) this.menu.addMenuItem(this.thermal.submenu);
			else this.settings.thermalMode = 0;

			this.initPanelWidgets();
			this.initGraphs();

			this.onGraphTypeChanged();
			this.graph.items.forEach(function(item, i){
				//To supress menu from closing
				item.activate = Lang.bind(this, function(){
					this.settings.graphType = i;
					this.onGraphTypeChanged();
				});
				this.graph.submenu.menu.addMenuItem(item);
			}, this);
			this.menu.addMenuItem(this.graph.submenu);

			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			let _gsmApp = _appSys.lookup_app("gnome-system-monitor.desktop");
			item = new PopupMenu.PopupMenuItem(_("System Monitor"));
			item.connect("activate", function(){
				_gsmApp.activate();
			});
			this.menu.addMenuItem(item);

			this.onSettingsChanged();
			this.getData();
			this.paint();
		} catch(e){
			global.logError(e);
		}
	},
	initGraphs: function(){
		this.canvas = new St.DrawingArea({height: this.settings.graphSize});
		this.canvas.connect("repaint", this.draw.bind(this));
		this.canvasHolder = new PopupMenu.PopupBaseMenuItem({activate: false, sensitive: false});
		this.canvasHolder.actor.connect("scroll-event", this.onScroll.bind(this));
		this.canvasHolder.addActor(this.canvas, {span: -1, expand: true});
		this.menu.addMenuItem(this.canvasHolder);

		this.graphs = [
			new Graph.Pie(this.canvas, this.modules, this.settings, this.colors),
			new Graph.Arc(this.canvas, this.modules, this.settings, this.colors),
			new Graph.CPUHistory(this.canvas, this.modules, this.settings, this.colors),
			new Graph.MemorySwapHistory(this.canvas, this.modules, this.settings, this.colors),
			new Graph.DiskHistory(this.canvas, this.modules, this.settings, this.colors),
			new Graph.NetworkHistory(this.canvas, this.modules, this.settings, this.colors),
			new Graph.ThermalHistory(this.canvas, this.modules, this.settings, this.colors)
		];
	},

	initPanelWidgets: function(){
		this.set_applet_tooltip(_("System monitor"));

		let iconBox = new St.Bin();
		let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: "system-status-icon"});
		iconBox.child = icon;
		this.actor.add(iconBox, {y_align: St.Align.MIDDLE, y_fill: false});

		this.panelWidgets = [];

		this.addPanelWidget([Graph.CPUBar, Graph.CPUHistory], "Cpu");
		this.addPanelWidget([Graph.MemoryBar, Graph.MemoryHistory, Graph.MemorySwapBar, Graph.MemorySwapHistory], "Mem");
		this.addPanelWidget([Graph.DiskBar, Graph.DiskHistory], "Disk");
		this.addPanelWidget([Graph.NetworkBar, Graph.NetworkHistory], "Network");
		this.addPanelWidget([Graph.ThermalBar, Graph.ThermalHistory], "Thermal");
	},
	addPanelWidget: function(graphs, name){
		let widget = new PanelWidget(this.panelHeight, this.modules, this.settings, this.colors, name);
		for(var i = 0, l = graphs.length; i < l; ++i)
			widget.addGraph(graphs[i]);
		this.panelWidgets.push(widget);
		widget.canvas.set
		this.actor.add(widget.canvas);
	},
	updatePanelWidgets: function(){
		for(var i = 0, l = this.panelWidgets.length; i < l; ++i)
			this.panelWidgets[i].update();
	},

	getData: function(){
		try {
			let i, j, l, r = 0;

			let time = GLib.get_monotonic_time() / 1e6;
			let delta = time - this.time[0];
			this.time[0] = time;

			while(this.swap.history.length > this.settings.graphSteps + 1){
				for(i = 0; i < this.cpu.count; ++i){
					this.cpu.history.user[i].shift();
					this.cpu.history.system[i].shift();
				}
				this.mem.history.usedup.shift();
				this.mem.history.cached.shift();
				this.mem.history.buffer.shift();
				this.swap.history.shift();
			}

			while(this.disk.history.write.length > this.settings.graphSteps + 1){
				this.disk.history.write.shift();
				this.disk.history.read.shift();
			}
			while(this.network.history.up.length > this.settings.graphSteps + 1){
				this.network.history.up.shift();
				this.network.history.down.shift();
			}

			if(this.settings.thermalMode){
				while(this.thermal.history[0].length > this.settings.graphSteps + 1){
					for(i = 0, l = this.thermal.history.length; i < l; ++i)
						this.thermal.history[i].shift();
				}
			}

			GTop.glibtop_get_cpu(this.cpu.gtop);
			for(i = 0; i < this.cpu.count; ++i){
				var dtotal = this.cpu.gtop.xcpu_total[i] - this.cpu.raw.total[i];
				var duser = this.cpu.gtop.xcpu_user[i] - this.cpu.raw.user[i];
				var dsystem = this.cpu.gtop.xcpu_sys[i] - this.cpu.raw.system[i];

				this.cpu.raw.total[i] = this.cpu.gtop.xcpu_total[i];
				this.cpu.raw.user[i] = this.cpu.gtop.xcpu_user[i];
				this.cpu.raw.system[i] = this.cpu.gtop.xcpu_sys[i];

				this.cpu.data.user[i] = duser / dtotal;
				this.cpu.data.system[i] = dsystem / dtotal;
				this.cpu.data.usage[i] = this.cpu.data.user[i] + this.cpu.data.system[i];

				this.cpu.history.user[i].push(this.cpu.data.user[i]);
				this.cpu.history.system[i].push(this.cpu.data.user[i] + this.cpu.data.system[i]);

				if(this.settings.cpuWarning){
					if(this.settings.cpuWarningMode)
						r += this.cpu.data.usage[i];
					else {
						if(this.cpu.data.usage[i] >= this.settings.cpuWarningValue / 100){
							if(--this.notifications.cpu[i] == 0)
								this.notify("Warning:", "CPU core " + (i + 1) + " usage was over " + this.settings.cpuWarningValue + "% for " + this.settings.cpuWarningTime * this.settings.interval / 1000 + "sec");
						} else
							this.notifications.cpu[i] = this.settings.cpuWarningTime;
					}
				}
			}

			if(this.settings.cpuWarning && this.settings.cpuWarningMode){
				if(r / this.cpu.count >= this.settings.cpuWarningValue / 100){
					if(--this.notifications.cpu == 0)
						this.notify("Warning:", "CPU usage was over " + this.settings.cpuWarningValue + "% for " + this.settings.cpuWarningTime * this.settings.interval / 1000 + "sec");
				} else
					this.notifications.cpu = this.settings.cpuWarningTime;
			}


			GTop.glibtop_get_mem(this.mem.gtop);

			this.mem.data.total = this.mem.gtop.total;
			this.mem.data.used = this.mem.gtop.used;
			this.mem.data.buffer = this.mem.gtop.buffer;
			this.mem.data.cached = this.mem.gtop.cached;
			this.mem.data.usedup = this.mem.data.used - this.mem.data.buffer - this.mem.data.cached;

			this.mem.history.usedup.push(this.mem.data.usedup / this.mem.data.total);
			this.mem.history.cached.push((this.mem.data.usedup + this.mem.data.cached) / this.mem.data.total);
			this.mem.history.buffer.push((this.mem.data.usedup + this.mem.data.cached + this.mem.data.buffer) / this.mem.data.total);


			GTop.glibtop_get_swap(this.swap.gtop);

			this.swap.data.total = this.swap.gtop.total;
			this.swap.data.used = this.swap.gtop.used;

			this.swap.history.push(this.swap.data.used / this.swap.data.total);


			let write = 0, read = 0;
			for(i = 0; i < this.disk.dev.length; ++i){
				GTop.glibtop_get_fsusage(this.disk.gtop, this.disk.dev[i].path);

				this.disk.dev[i].size = this.disk.gtop.block_size;
				this.disk.dev[i].free = this.disk.gtop.bfree;
				this.disk.dev[i].blocks = this.disk.gtop.blocks;

				write += this.disk.gtop.write * this.disk.dev[i].size;
				read += this.disk.gtop.read * this.disk.dev[i].size;
			}

			if(delta > 0 && this.disk.raw.write && this.disk.raw.read){
				this.disk.data.write = (write - this.disk.raw.write) / delta;
				this.disk.data.read = (read - this.disk.raw.read) / delta;

				this.disk.history.write.push(this.disk.data.write);
				this.disk.history.read.push(this.disk.data.read);

				if(this.disk.max <= this.disk.data.write){
					this.disk.max = this.disk.data.write;
					this.disk.maxIndex = 0;
				}

				if(this.disk.max <= this.disk.data.read){
					this.disk.max = this.disk.data.read;
					this.disk.maxIndex = 0;
				}

				if(++this.disk.maxIndex > this.settings.graphSteps + 1){
					this.disk.max = Math.max(this.disk.data.write, this.disk.data.read, 1);
					this.disk.maxIndex = 0;
					for(i = 1, l = this.disk.history.write.length; i < l; ++i){
						if(this.disk.max < this.disk.history.write[i]){
							this.disk.max = this.disk.history.write[i];
							this.disk.maxIndex = i;
						}
						if(this.disk.max < this.disk.history.read[i]){
							this.disk.max = this.disk.history.read[i];
							this.disk.maxIndex = i;
						}
					}
				}
			}

			this.disk.raw.write = write;
			this.disk.raw.read = read;


			let up = [0], down = [0];
			j = 1;
			for(i in this.network.dev){
				GTop.glibtop_get_netload(this.network.gtop, i);
				up[0] += up[j] = this.network.gtop.bytes_out;
				down[0] += down[j] = this.network.gtop.bytes_in;
				++j;
			}

			if(delta > 0 && this.network.raw.up && this.network.raw.down){
				for(i = 0, l = up.length; i < l; ++i){
					this.network.data.up[i] = this.network.raw.up[i]? (up[i] - this.network.raw.up[i]) / delta : 0;
					this.network.data.down[i] = this.network.raw.down[i]? (down[i] - this.network.raw.down[i]) / delta : 0;
				}
				this.network.history.up.push(this.network.data.up[0]);
				this.network.history.down.push(this.network.data.down[0]);

				if(this.network.max <= this.network.data.up[0]){
					this.network.max = this.network.data.up[0];
					this.network.maxIndex = 0;
				}

				if(this.network.max <= this.network.data.down[0]){
					this.network.max = this.network.data.down[0];
					this.network.maxIndex = 0;
				}

				if(++this.network.maxIndex > this.settings.graphSteps + 1){
					this.network.max = Math.max(this.network.data.up[0], this.network.data.down[0], 1);
					this.network.maxIndex = 0;
					for(i = 1, l = this.network.history.up.length; i < l; ++i){
						if(this.network.max < this.network.history.up[i]){
							this.network.max = this.network.history.up[i];
							this.network.maxIndex = i;
						}
						if(this.network.max < this.network.history.down[i]){
							this.network.max = this.network.history.down[i];
							this.network.maxIndex = i;
						}
					}
				}
			}

			this.network.raw.up = up;
			this.network.raw.down = down;

			if(this.settings.thermalMode)
				this.trySpawnAsyncPipe(this.thermal.path, this.getThermalData.bind(this));

			if(this.menu.isOpen) this.updateMenuItems();

			this.timeout = Mainloop.timeout_add(this.settings.interval, this.getData.bind(this));
		} catch(e){
			global.logError(e);
		}
	},
	getThermalData: function(command, sucess, result){
		try {
			let r = result.split("\n");

			this.thermal.data[0] = 0;
			for(var i = 0, l = this.thermal.sensors.length; i < l; ++i){
				this.thermal.history[i + 1].push(this.thermal.data[i + 1] = parseFloat(r[this.thermal.sensors[i]].match(/\d+\.\d+/)));
				if(this.thermal.min > this.thermal.data[i + 1] || !this.thermal.min) this.thermal.min = this.thermal.data[i + 1];
				if(this.thermal.max < this.thermal.data[i + 1] || !this.thermal.max) this.thermal.max = this.thermal.data[i + 1];

				if(this.settings.thermalMode === 1 && this.thermal.data[0] > this.thermal.data[i + 1] || this.thermal.data[0] == 0) this.thermal.data[0] = this.thermal.data[i + 1];
				else if(this.settings.thermalMode === 2) this.thermal.data[0] += this.thermal.data[i + 1];
				else if(this.settings.thermalMode === 3 && this.thermal.data[0] < this.thermal.data[i + 1]) this.thermal.data[0] = this.thermal.data[i + 1];
			}
			if(this.settings.thermalMode === 2) this.thermal.data[0] /= l;
			this.thermal.history[0].push(this.thermal.data[0]);

			if(this.settings.thermalWarning && this.thermal.data[0] > this.settings.thermalWarningValue){
				if(--this.notifications.thermal == 0)
					this.notify("Warning:", "Temperature was over " + this.formatthermal(this.settings.thermalWarningValue) + " for " + this.settings.thermalWarningTime * this.settings.interval / 1000 + "sec");
			} else
				this.notifications.thermal = this.settings.thermalWarningTime;

			this.time[1] = GLib.get_monotonic_time() / 1e6;
		} catch(e){
			global.logError(e);
		}
	},
	trySpawnAsyncPipe: function(command, callback){
		let terminal = new Terminal.TerminalReader(command, callback);
		terminal.executeReader();
		return terminal;
	},
	paint: function(once){
		if(this.menu.isOpen)
			this.canvas.queue_repaint();

		for(var i = 0, l = this.panelWidgets.length; i < l; ++i){
			if(this.settings["panel" + this.panelWidgets[i].name + "Graph"] !== -1)
				this.panelWidgets[i].paint();
		}

		if(!once)
			this.paintTimeout = Mainloop.timeout_add(this.settings.graphInterval, this.paint.bind(this));
	},
	draw: function(){
		this.graphs[this.settings.graphType].draw();
	},
	updateMenuItems: function(){
		try {
			let i, l;
			for(i = 0; i < this.cpu.count; ++i){
				this.cpu.container[0].get_children()[i].set_text(this.formatpercent(this.cpu.data.usage[i]));
				this.cpu.container[1].get_children()[i].set_text(this.formatpercent(this.cpu.data.user[i]));
				this.cpu.container[2].get_children()[i].set_text(this.formatpercent(this.cpu.data.system[i]));
			}

			this.mem.container[0].get_children()[0].set_text(this.formatbytes(this.mem.data.used));
			this.mem.container[0].get_children()[1].set_text(this.formatbytes(this.mem.data.total));
			this.mem.container[0].get_children()[2].set_text(this.formatpercent(this.mem.data.used, this.mem.data.total));
			this.mem.container[1].get_children()[0].set_text(this.formatbytes(this.mem.data.usedup));
			this.mem.container[1].get_children()[1].set_text(this.formatpercent(this.mem.data.usedup, this.mem.data.total));
			this.mem.container[2].get_children()[0].set_text(this.formatbytes(this.mem.data.cached));
			this.mem.container[2].get_children()[1].set_text(this.formatpercent(this.mem.data.cached, this.mem.data.total));
			this.mem.container[3].get_children()[0].set_text(this.formatbytes(this.mem.data.buffer));
			this.mem.container[3].get_children()[1].set_text(this.formatpercent(this.mem.data.buffer, this.mem.data.total));

			this.swap.container[0].get_children()[0].set_text(this.formatbytes(this.swap.data.used));
			this.swap.container[0].get_children()[1].set_text(this.formatbytes(this.swap.data.total));
			this.swap.container[0].get_children()[2].set_text(this.formatpercent(this.swap.data.used, this.swap.data.total));

			this.disk.container[0].get_children()[this.settings.order? 0 : 1].set_text(this.formatrate(this.disk.data.write) + " \u25B2");
			this.disk.container[0].get_children()[this.settings.order? 1 : 0].set_text(this.formatrate(this.disk.data.read) + " \u25BC");
			for(i = 0; i < this.disk.dev.length; ++i){
				this.disk.container[i + 1].get_children()[0].set_text(this.formatbytes((this.disk.dev[i].blocks - this.disk.dev[i].free) * this.disk.dev[i].size));
				this.disk.container[i + 1].get_children()[1].set_text(this.formatbytes(this.disk.dev[i].blocks * this.disk.dev[i].size));
				this.disk.container[i + 1].get_children()[2].set_text(this.formatpercent(this.disk.dev[i].blocks - this.disk.dev[i].free, this.disk.dev[i].blocks));
			}

			for(i = 0, l = this.network.data.up.length; i < l; ++i){
				this.network.container[i].get_children()[this.settings.order? 0 : 1].set_text(this.formatrate(this.network.data.up[i]) + " \u25B2");
				this.network.container[i].get_children()[this.settings.order? 1 : 0].set_text(this.formatrate(this.network.data.down[i]) + " \u25BC");
			}
			this.network.container[i].get_children()[this.settings.order? 0 : 1].set_text(this.formatbytes(this.network.raw.up[0]) + " \u25B2");
			this.network.container[i].get_children()[this.settings.order? 1 : 0].set_text(this.formatbytes(this.network.raw.down[0]) + " \u25BC");

			for(i = 0, l = this.thermal.data.length; i < l; ++i)
				this.thermal.container[i].get_children()[0].set_text(this.formatthermal(this.thermal.data[i]));
		} catch(e){
			global.logError(e);
		}
	},
	notify: function(summary, body){
		let source = new MessageTray.SystemNotificationSource();
		messageTray.add(source);

		let icon = new St.Icon({icon_name: iconName,	icon_type: St.IconType.FULLCOLOR, icon_size: 24});

		//don't save the notification and open menu on click
		let notification = new MessageTray.Notification(source, summary, body, {icon: icon});
		notification.setTransient(true);
		notification.connect("clicked", Lang.bind(this, function(){
			this.menu.open();
		}));

		source.notify(notification);
	},
	formatbytes: function(bytes){
		let prefix = " KMGTPEZY";
		let a = 1, j = 0;
		while(bytes / a > this.settings.maxsize){
			a *= this.settings.byteUnit? 1024 : 1000;
			++j;
		}
		return (bytes / a).toFixed(1) + " " + prefix[j] + (this.settings.byteUnit && j? "i" : "") + "B";
	},
	formatrate: function(bytes){
		let prefix = " KMGTPEZY";
		let a = (this.settings.rateUnit < 2? 1 : .125), j = 0;
		while(bytes / a > this.settings.maxsize){
			a *= this.settings.rateUnit & 1? 1024 : 1000;
			++j;
		}
		return (bytes / a).toFixed(1) + " " + prefix[j] + (this.settings.rateUnit & 1 && j? "i" : "") + (this.settings.rateUnit < 2? "B" : "bit") + "/s";
	},
	formatpercent: function(part, total){
		return (100 * part / (total || 1)).toFixed(1) + "%";
	},
	formatthermal: function(celsius){
		return (this.settings.thermalUnit? celsius : celsius * 1.8 + 32).toFixed(1) + "\u00b0" + (this.settings.thermalUnit? "C" : "F");
	},
	on_applet_clicked: function(){
		this.menu.toggle();
		if(this.menu.isOpen) this.updateMenuItems();
	},
	on_applet_removed_from_panel: function(){
		Mainloop.source_remove(this.timeout);
		Mainloop.source_remove(this.paintTimeout);
	},
	onSettingsChanged: function(){
		try {
			["thermal", "write", "read", "cpu1", "cpu2", "cpu3", "cpu4", "mem", "swap"].forEach(function(p){
				let c = this.settings[p].split(","), i;
				for(i = 0; i < 3; ++i)
					c[i] = parseInt(c[i].match(/\d+/)) / 255; //rgba[0-255] -> rgb[0-1]
				this.colors[p] = c;
			}, this);
			this.canvas.set_height(this.settings.graphSize);
			if(this.settings.cpuWarning){
				if(this.settings.cpuWarningMode)
					this.notifications.cpu = this.settings.cpuWarningTime;
				else {
					this.notifications.cpu = [];
					for(var i = 0; i < this.cpu.count; ++i)
						this.notifications.cpu.push(this.settings.cpuWarningTime);
				}
			}
			if(this.settings.thermalWarning){
				this.notifications.thermal = this.settings.thermalWarningTime;
				if(!this.settings.thermalUnit) this.settings.thermalWarningValue = (this.settings.thermalWarningValue - 32) * 5 / 9; //Fahrenheit => Celsius
			}
		} catch(e){
			global.logError(e);
		}
	},
	onGraphTypeChanged: function(){
		try {
			this.graph.items.forEach(function(item){
				item.setShowDot(false);
			});

			if(this.settings.graphType === -1){
				this.graph.submenu.actor.hide();
				this.canvasHolder.actor.hide();
			} else {
				this.graph.submenu.actor.show();
				this.canvasHolder.actor.show();
				this.graph.items[this.settings.graphType].setShowDot(true);
			}
			this.paint(true);
		} catch(e){
			global.logError(e);
		}
	},
	onScroll: function(actor, event){
		try {
			let direction = event.get_scroll_direction();

			if(direction == Clutter.ScrollDirection.DOWN && this.settings.graphType < 6)
				this.settings.graphType++;
			else if(direction == Clutter.ScrollDirection.UP && this.settings.graphType > 0)
				this.settings.graphType--;

			this.onGraphTypeChanged();
		} catch(e){
			global.logError(e);
		}
	}
};

function main(metadata, orientation, panelHeight, instanceId){
	let systemMonitorApplet = new SystemMonitorApplet(orientation, panelHeight, instanceId);
	return systemMonitorApplet;
}
