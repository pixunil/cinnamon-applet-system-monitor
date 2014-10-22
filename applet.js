const Applet = imports.ui.applet;

const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Settings = imports.ui.settings;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;

const Mainloop = imports.mainloop;
const Util = imports.misc.util;

const MessageTray = imports.ui.messageTray;
let messageTray = new MessageTray.MessageTray;

try {
	const GTop = imports.gi.GTop;
} catch (e){
	Util.spawnCommandLine("notify-send -i utilities-system-monitor 'Dependence missing' 'Please install the GTop package\n\
\tUbuntu / Mint: gir1.2-gtop-2.0\n\
\tFedora: libgtop2-devel\n\
\tArch: libgtop'");
}

function SystemMonitorApplet(metadata, orientation, instanceId){
	this._init(metadata, orientation, instanceId);
}

SystemMonitorApplet.prototype = {
	__proto__: Applet.IconApplet.prototype,

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

	time: 0,

	graph: {
		timeout: null,
		submenu: new PopupMenu.PopupSubMenuMenuItem(_("Graph")),
		items: [new PopupMenu.PopupMenuItem(_("Pie")), new PopupMenu.PopupMenuItem(_("Arc")), new PopupMenu.PopupMenuItem(_("CPU History")), new PopupMenu.PopupMenuItem(_("Memory History")),
			new PopupMenu.PopupMenuItem(_("Disk History")), new PopupMenu.PopupMenuItem(_("Network History")), new PopupMenu.PopupMenuItem(_("Thermal History"))]
	},

	_init: function(metadata, orientation, instanceId){
		Applet.IconApplet.prototype._init.call(this, orientation);

		try {
			let item, i, l, j, r, s, t, _appSys = Cinnamon.AppSystem.get_default();
			this.set_applet_icon_symbolic_name("utilities-system-monitor");
			this.set_applet_tooltip(_("System monitor"));

			this.Terminal = imports.ui.appletManager.applets[metadata.uuid].terminal;

			this.settings = {};
			this.colors = {};
			this.notifications = {};
			this.settingProvider = new Settings.AppletSettings(this.settings, metadata.uuid, instanceId);
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

				this.settingProvider.bindProperty(Settings.BindingDirection.IN, p, q, this.on_settings_changed.bind(this));
			}, this);

			this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "graph-type", "graphType", this.onGraphTypeChanged.bind(this));

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

			this.canvas = new St.DrawingArea({height: this.settings.graphSize});
			this.canvas.connect("repaint", this.draw.bind(this));
			this.canvasHolder = new PopupMenu.PopupBaseMenuItem({reactive: false});
			this.canvasHolder.addActor(this.canvas, {span: -1, expand: true});
			this.menu.addMenuItem(this.canvasHolder);

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

			this.on_settings_changed();
			this.getData();

		} catch(e){
			global.logError(e);
		}
	},
	getData: function(){
		try {
			let i, j, l, r = 0;

			let time = GLib.get_monotonic_time() / 1e6;
			let delta = time - this.time;
			this.time = time;

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

			if(this.menu.isOpen) this.refresh();
			this.timeout = Mainloop.timeout_add(this.settings.interval, this.getData.bind(this));
		} catch(e){
			global.logError(e);
		}
	},
	getThermalData: function(command, sucess, result){
		try {
			let r = result.split("\n");

			this.thermal.data[0] = 0;
			for(i = 0, l = this.thermal.sensors.length; i < l; ++i){
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

			this.thermaltime = GLib.get_monotonic_time() / 1e6;
		} catch(e){
			global.logError(e);
		}
	},
	trySpawnAsyncPipe: function(command, callback){
		let terminal = new this.Terminal.TerminalReader(command, callback);
		terminal.executeReader();
		return terminal;
	},
	draw: function(){
		try {
			let ctx = this.canvas.get_context();
			let w = this.canvas.get_width();
			let h = this.canvas.get_height();
			var steps = this.settings.graphSteps;

			if(this.settings.graphType == 0){
				function arc(angle, dir){
					if(dir) ctx.arc(w / 2, h / 2, r, a, a += angle);
					else ctx.arcNegative(w / 2, h / 2, r, a, a -= angle);
					ctx.stroke();
				}

				let dr = h / (this.cpu.count + 4) / 2;
				var r = dr, a;
				ctx.setLineWidth(dr);

				if(this.settings.thermalMode){
					ctx.setSourceRGB(this.colors.thermal[0], this.colors.thermal[1], this.colors.thermal[2]);
					ctx.arc(w / 2, h / 2, (this.thermal.data[0] - this.thermal.min) / (this.thermal.max - this.thermal.min) * dr, 0, Math.PI * 2);
					ctx.fill();
				}

				r += dr / 2;
				ctx.setSourceRGB(this.colors.read[0], this.colors.read[1], this.colors.read[2]);
				a = -Math.PI;
				arc(Math.PI * this.disk.data.read / this.disk.max / 2, false);
				a = 0;
				arc(Math.PI * this.network.data.down[0] / this.network.max / 2, true);
				ctx.setSourceRGB(this.colors.write[0], this.colors.write[1], this.colors.write[2]);
				a = -Math.PI;
				arc(Math.PI * this.disk.data.write / this.disk.max / 2, true);
				a = 0;
				arc(Math.PI * this.network.data.up[0] / this.network.max / 2, false);

				r += dr;
				a = -Math.PI / 2;
				for(let i = 0; i < this.cpu.count; ++i){
					ctx.setSourceRGB(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2]);
					arc(Math.PI * this.cpu.data.user[i] * 2, true);
					ctx.setSourceRGBA(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2], .75);
					arc(Math.PI * this.cpu.data.system[i] * 2, true);
					r += dr;
					a = -Math.PI / 2;
				}

				ctx.setSourceRGB(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2]);
				arc(Math.PI * this.mem.data.usedup / this.mem.data.total * 2, false);
				ctx.setSourceRGBA(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2], .75);
				arc(Math.PI * this.mem.data.cached / this.mem.data.total * 2, false);
				ctx.setSourceRGBA(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2], .5);
				arc(Math.PI * this.mem.data.buffer / this.mem.data.total * 2, false);

				r += dr;
				a = -Math.PI / 2;
				ctx.setSourceRGB(this.colors.swap[0], this.colors.swap[1], this.colors.swap[2]);
				arc(Math.PI * this.swap.data.used / this.swap.data.total * 2, false);
			} else if(this.settings.graphType == 1){
				function arc(angle){
					if(a === 0){
						a = angle /= 2;
						ctx.arc(w / 2, h, r, -a - Math.PI / 2, a - Math.PI / 2);
					} else {
						angle /= 2;
						ctx.arc(w / 2, h, r, a - Math.PI / 2, a + angle - Math.PI / 2);
						ctx.stroke();
						ctx.arcNegative(w / 2, h, r, -a - Math.PI / 2, -a - angle - Math.PI / 2);
						a += angle;
					}
					ctx.stroke();
				}
				function quarterArc(angle, dir){
					if(dir) ctx.arc(w / 2, h, r, -Math.PI / 2, angle - Math.PI / 2);
					else ctx.arcNegative(w / 2, h, r, -Math.PI / 2, -angle - Math.PI / 2);
					ctx.stroke();
				}

				var dr = Math.min(w / (this.cpu.count + 5.5) / 2, h / (this.cpu.count + 5.5));
				var r = dr, a = 0;

				ctx.setLineWidth(dr);

				if(this.settings.thermalMode){
					ctx.setSourceRGB(this.colors.thermal[0], this.colors.thermal[1], this.colors.thermal[2]);
					ctx.arc(w / 2, h, (this.thermal.data[0] - this.thermal.min) / (this.thermal.max - this.thermal.min) * dr, Math.PI, 0);
					ctx.fill();
				}

				r += dr;

				ctx.setSourceRGB(this.colors.read[0], this.colors.read[1], this.colors.read[2]);
				quarterArc(Math.PI * this.network.data.down[0] / this.network.max / 2, this.settings.order);
				r += dr;
				quarterArc(Math.PI * this.disk.data.read / this.disk.max / 2, this.settings.order);

				ctx.setSourceRGB(this.colors.write[0], this.colors.write[1], this.colors.write[2]);
				r -= dr;
				quarterArc(Math.PI * this.network.data.up[0] / this.network.max / 2, !this.settings.order);
				r += dr;
				quarterArc(Math.PI * this.disk.data.write / this.disk.max / 2, !this.settings.order);

				r += dr;

				for(let i = 0; i < this.cpu.count; ++i){
					ctx.setSourceRGB(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2]);
					arc(Math.PI * this.cpu.data.user[i]);
					ctx.setSourceRGBA(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2], .75);
					arc(Math.PI * this.cpu.data.system[i]);
					r += dr;
					a = 0;
				}

				ctx.setSourceRGB(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2]);
				arc(Math.PI * this.mem.data.usedup / this.mem.data.total);
				ctx.setSourceRGBA(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2], .75);
				arc(Math.PI * this.mem.data.cached / this.mem.data.total);
				ctx.setSourceRGBA(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2], .5);
				arc(Math.PI * this.mem.data.buffer / this.mem.data.total);

				r += dr;
				a = 0;
				ctx.setSourceRGB(this.colors.swap[0], this.colors.swap[1], this.colors.swap[2]);
				arc(Math.PI * this.swap.data.used / this.swap.data.total);
			} else {
				if(this.settings.graphAppearance === 0){
					function line(history){
						ctx.moveTo(dw * tx, h - (history[0] - min) / (max - min) * h);
						connection(history, 1);
						ctx.stroke();
					}
				} else if(this.settings.graphAppearance === 1){
					function line(history, num, total){
						ctx.translate(0, h * num / total);
						ctx.scale(1, 1 / total);

						ctx.moveTo(dw * tx, h);
						ctx.lineTo(dw * tx, h - (history[0] - min) / (max - min) * h);
						connection(history, 1);
						ctx.lineTo(dw * (history.length - 1 + tx), h);
						ctx.fill();

						ctx.identityMatrix();
					}
				} else if(this.settings.graphAppearance === 2){
					function line(history, num, total){
						var l = history.length;
						for(var i = 0; i < l; ++i)
							ctx.rectangle(dw * (i + tx) + dw * num / total, h, dw / total, -(history[i] - min) / (max - min) * h);
						ctx.fill();
					}
				}

				if(this.settings.graphConnection === 0){
					function connection(history, i){
						for(var l = history.length; i < l; ++i)
							ctx.lineTo(dw * (i + tx), h - (history[i] - min) / (max - min) * h);
					}
				} else if(this.settings.graphConnection === 1){
					function connection(history, i){
						for(var l = history.length; i < l; ++i){
							ctx.lineTo(dw * (i + tx - .5), h - (history[i - 1] - min) / (max - min) * h);
							ctx.lineTo(dw * (i + tx - .5), h - (history[i] - min) / (max - min) * h);
							ctx.lineTo(dw * (i + tx), h - (history[i] - min) / (max - min) * h);
						}
					}
				} else {
					function connection(history, i){
						for(var l = history.length; i < l; ++i)
							ctx.curveTo(dw * (i + tx - .5), h - (history[i - 1] - min) / (max - min) * h, dw * (i + tx - .5), h - (history[i] - min) / (max - min) * h, dw * (i + tx), h - (history[i] - min) / (max - min) * h);
					}
				}

				var dw = w / steps,
					deltaT = (GLib.get_monotonic_time() / 1e3 - this.time * 1e3) / this.settings.interval,
					tx = steps + 2 - deltaT,
					min = 0,
					max = 1;

				if(this.settings.graphType == 2){
					tx -= this.cpu.history.user[0].length;

					for(let i = 0; i < this.cpu.count; ++i){
						ctx.setSourceRGB(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2]);
						line(this.cpu.history.user[i], i, this.cpu.count);
						ctx.setSourceRGBA(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2], .75);
						line(this.cpu.history.system[i], i, this.cpu.count);
					}
				} else if(this.settings.graphType == 3){
					tx -= this.mem.history.usedup.length;

					ctx.setSourceRGB(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2]);
					line(this.mem.history.usedup, 0, 2);
					ctx.setSourceRGBA(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2], .75);
					line(this.mem.history.cached, 0, 2);
					ctx.setSourceRGBA(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2], .5);
					line(this.mem.history.buffer, 0, 2);

					ctx.setSourceRGB(this.colors.swap[0], this.colors.swap[1], this.colors.swap[2]);
					line(this.swap.history, 1, 2);
				} else if(this.settings.graphType == 4){
					tx -= this.disk.history.write.length;
					max = this.disk.max;

					ctx.setSourceRGB(this.colors.write[0], this.colors.write[1], this.colors.write[2]);
					line(this.disk.history.write, 0, 2);

					ctx.setSourceRGB(this.colors.read[0], this.colors.read[1], this.colors.read[2]);
					line(this.disk.history.read, 1, 2);
				} else if(this.settings.graphType == 5){
					tx -= this.network.history.up.length;
					max = this.network.max;

					ctx.setSourceRGB(this.colors.write[0], this.colors.write[1], this.colors.write[2]);
					line(this.network.history.up, 0, 2);

					ctx.setSourceRGB(this.colors.read[0], this.colors.read[1], this.colors.read[2]);
					line(this.network.history.down, 1, 2);
				} else if(this.settings.graphType == 6){
					deltaT = (GLib.get_monotonic_time() / 1e3 - this.thermaltime * 1e3) / this.settings.interval;
					tx = steps + 2 - deltaT - this.thermal.history[0].length;
					min = this.thermal.min;
					max = this.thermal.max;

					for(var i = 1, l = this.thermal.history.length; i < l; ++i){
						if(this.thermal.colors[i]) ctx.setSourceRGBA(this.colors["cpu" + this.thermal.colors[i]][0], this.colors["cpu" + this.thermal.colors[i]][1], this.colors["cpu" + this.thermal.colors[i]][2], 1);
						else ctx.setSourceRGBA(this.colors.thermal[0], this.colors.thermal[1], this.colors.thermal[2], (l - i / 4) / l);
						line(this.thermal.history[i], i, l);
					}

					ctx.setSourceRGB(this.colors.thermal[0], this.colors.thermal[1], this.colors.thermal[2]);
					ctx.setDash([5, 5], 0);
					line(this.thermal.history[0], 0, l);
				}

				this.graph.timeout = Mainloop.timeout_add(this.settings.graphInterval, Lang.bind(this, function(){
					this.canvas.queue_repaint();
				}));
			}
		} catch(e){
			global.logError(e);
		}
	},
	startDraw: function(){
		if(this.settings.graphType === -1 || (this.settings.graphType > 1 && this.graph.timeout)) return;
		if(this.graph.timeout)
			this.graph.timeout = null;
		this.canvas.queue_repaint();
	},
	endDraw: function(){
		if(this.graph.timeout) Mainloop.source_remove(this.graph.timeout);
		this.graph.timeout = null;
	},
	refresh: function(){
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

			this.startDraw();
		} catch(e){
			global.logError(e);
		}
	},
	notify: function(summary, body){
		let source = new MessageTray.SystemNotificationSource();
		messageTray.add(source);

		let icon = new St.Icon({
			icon_name: "utilities-system-monitor",
			icon_type: St.IconType.FULLCOLOR,
			icon_size: 24
		});

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
		if(this.menu.isOpen) this.refresh();
		else this.endDraw();
	},
	on_applet_removed_from_panel: function(){
		Mainloop.source_remove(this.timeout);
	},
	on_settings_changed: function(){
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
				this.startDraw();
			}
		} catch(e){
			global.logError(e);
		}
	}
};

function main(metadata, orientation, panelHeight, instanceId){
	let systemMonitorApplet = new SystemMonitorApplet(metadata, orientation, instanceId);
	return systemMonitorApplet;
}
