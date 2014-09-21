const Applet = imports.ui.applet;

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;

const NMClient = imports.gi.NMClient;
const NetworkManager = imports.gi.NetworkManager;
try {
	const GTop = imports.gi.GTop;
} catch (e){
	Util.spawnCommandLine("notify-send -i utilities-system-monitor 'Dependence missing' 'Please install the GTop package\n\
\tUbuntu: gir1.2-gtop-2.0\n\
\tFedora: libgtop2-devel\n\
\tArch: libgtop'");
}

function MyApplet(metadata, orientation, instanceId){
	this._init(metadata, orientation, instanceId);
}

MyApplet.prototype = {
	__proto__: Applet.IconApplet.prototype,

	cpu: {
		gtop: new GTop.glibtop_cpu(),
		count: GTop.glibtop_get_sysinfo().ncpu,
		total: [],
		user: [],
		system: [],
		submenu: new PopupMenu.PopupSubMenuMenuItem(_("CPU")),
		container: [new St.BoxLayout()]
	},
	mem: {
		gtop: new GTop.glibtop_mem(),
		submenu: new PopupMenu.PopupSubMenuMenuItem(_("Memory")),
		container: [new St.BoxLayout()]
	},
	swap: {
		gtop: new GTop.glibtop_swap(),
		submenu: new PopupMenu.PopupMenuItem(_("Swap"), {reactive: false}),
		container: [new St.BoxLayout()]
	},
	disk: {
		gtop: new GTop.glibtop_fsusage(),
		write: null,
		read: null,
		submenu: new PopupMenu.PopupSubMenuMenuItem(_("Disk")),
		container: [new St.BoxLayout()]
	},
	network: {
		gtop: new GTop.glibtop_netload(),
		up: null,
		down: null,
		dev: {},
		submenu: new PopupMenu.PopupSubMenuMenuItem(_("Network")),
		menuitem: [],
		container: [new St.BoxLayout()]
	},
	thermal: {
		sensors: [],
		colors: [],
		path: "",
		min: null,
		tmin: null,
		max: null,
		tmax: null,
		submenu: new PopupMenu.PopupSubMenuMenuItem(_("Thermal")),
		container: [new St.BoxLayout()]
	},

	data: {
		time: 0,
		cpu: {
			usage: [],
			system: [],
			user: []
		},
		mem: {},
		swap: {},
		mounts: [],
		disk: {max: 1},
		network: {
			up: [],
			down: [],
			max: 1
		},
		thermal: []
	},

	history: {
		cpu: {
			system: [],
			user: []
		},
		mem: {
			usedup: [],
			cached: [],
			buffer: []
		},
		swap: [],
		disk: {
			read: [],
			write: []
		},
		network: {
			up: [],
			down: []
		},
		thermal: [[]]
	},

	graph: {
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

			this.settings = {};
			this.colors = {};
			this.notifications = {};
			this.settingProvider = new Settings.AppletSettings(this.settings, metadata.uuid, instanceId);
			["interval", "byteunit", "rateunit", "maxsize", "rateunit", "order",
				"graphappearance", "graphsteps"].forEach(function(p){
				this.settingProvider.bindProperty(Settings.BindingDirection.IN, p, p);
			}, this);
			this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "thermalmode", "thermalmode");
			//Settings with callback
			["thermalunit", "graphsize", "thermal", "write", "read", "cpu1", "cpu2", "cpu3", "cpu4", "mem", "swap",
				"cpuwarning", "cpuwarningtime", "cpuwarningmode", "cpuwarningvalue", "thermalwarning", "thermalwarningtime", "thermalwarningvalue"].forEach(function(p){
				this.settingProvider.bindProperty(Settings.BindingDirection.IN, p, p, Lang.bind(this, this.on_settings_changed));
			}, this);

			this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "graphtype", "graphtype", Lang.bind(this, function(){
				this.graph.items.forEach(function(item){
					item.setShowDot(false);
				});
				this.graph.items[this.settings.graphtype].setShowDot(true);
				this.canvas.queue_repaint();
			}));

			this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this.menuManager.addMenu(this.menu);

			for(i = 0; i < this.cpu.count; ++i){
				this.cpu.total.push(0);
				this.cpu.user.push(0);
				this.cpu.system.push(0);

				this.history.cpu.user.push([]);
				this.history.cpu.system.push([]);

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
				if(mount[0].indexOf("/dev/") == 0 && this.data.mounts.indexOf(mount[1]) < 0){
					GTop.glibtop_get_fsusage(this.disk.gtop, mount[1]);
					this.data.mounts.push({
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
								this.history.thermal.push([]);
							}
						}
					}
				}
			}
			if(this.thermal.sensors.length) this.menu.addMenuItem(this.thermal.submenu);
			else this.settings.thermalmode = 0;

			this.canvas = new St.DrawingArea({height: this.settings.graphsize});
			this.canvas.connect("repaint", Lang.bind(this, this.draw));
			item = new PopupMenu.PopupBaseMenuItem({reactive: false});
			item.addActor(this.canvas, {span: -1, expand: true});
			this.menu.addMenuItem(item);

			this.graph.items[this.settings.graphtype].setShowDot(true);
			this.graph.items.forEach(function(item, i){
				//To supress menu from closing
				item.activate = Lang.bind(this, function(){
					this.graph.items[this.settings.graphtype].setShowDot(false);
					this.settings.graphtype = i;
					item.setShowDot(true);
					this.canvas.queue_repaint();
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
			let delta = time - this.data.time;
			this.data.time = time;

			while(this.history.swap.length >= this.settings.graphsteps){
				for(i = 0; i < this.cpu.count; ++i){
					this.history.cpu.user[i].shift();
					this.history.cpu.system[i].shift();
				}
				this.history.mem.usedup.shift();
				this.history.mem.cached.shift();
				this.history.mem.buffer.shift();
				this.history.swap.shift();
				this.history.disk.write.shift();
				this.history.disk.read.shift();
				this.history.network.up.shift();
				this.history.network.down.shift();
			}

			if(this.settings.thermalmode){
				while(this.history.thermal[0].length >= this.settings.graphsteps){
					for(i = 0, l = this.history.thermal.length; i < l; ++i)
						this.history.thermal[i].shift();
				}
			}

			GTop.glibtop_get_cpu(this.cpu.gtop);
			for(i = 0; i < this.cpu.count; ++i){
				var dtotal = this.cpu.gtop.xcpu_total[i] - this.cpu.total[i];
				var duser = this.cpu.gtop.xcpu_user[i] - this.cpu.user[i];
				var dsystem = this.cpu.gtop.xcpu_sys[i] - this.cpu.system[i];

				this.cpu.total[i] = this.cpu.gtop.xcpu_total[i];
				this.cpu.user[i] = this.cpu.gtop.xcpu_user[i];
				this.cpu.system[i] = this.cpu.gtop.xcpu_sys[i];

				this.history.cpu.user[i].push(this.data.cpu.user[i] = duser / dtotal);
				this.history.cpu.system[i].push((this.data.cpu.system[i] = dsystem / dtotal) + this.data.cpu.user[i]);
				this.data.cpu.usage[i] = this.data.cpu.user[i] + this.data.cpu.system[i];

				if(this.settings.cpuwarning){
					if(this.settings.cpuwarningmode)
						r += this.data.cpu.usage[i];
					else {
						if(this.data.cpu.usage[i] >= this.settings.cpuwarningvalue / 100){
							if(--this.notifications.cpu[i] == 0)
								this.notify("Warning:", "CPU core " + (i + 1) + " usage was over " + this.settings.cpuwarningvalue + "% for " + this.settings.cpuwarningtime * this.settings.interval / 1000 + "sec");
						} else
							this.notifications.cpu[i] = this.settings.cpuwarningtime;
					}
				}
			}

			if(this.settings.cpuwarning && this.settings.cpuwarningmode){
				if(r / this.cpu.count >= this.settings.cpuwarningvalue / 100){
					if(--this.notifications.cpu == 0)
						this.notify("Warning:", "CPU usage was over " + this.settings.cpuwarningvalue + "% for " + this.settings.cpuwarningtime * this.settings.interval / 1000 + "sec");
				} else
					this.notifications.cpu = this.settings.cpuwarningtime;
			}

			GTop.glibtop_get_mem(this.mem.gtop);
			this.data.mem.total = this.mem.gtop.total;
			this.data.mem.used = this.mem.gtop.used;
			this.data.mem.buffer = this.mem.gtop.buffer;
			this.data.mem.cached = this.mem.gtop.cached;
			this.history.mem.usedup.push((this.data.mem.usedup = this.data.mem.used - this.data.mem.buffer - this.data.mem.cached) / this.data.mem.total);
			this.history.mem.cached.push((this.data.mem.usedup + this.data.mem.cached) / this.data.mem.total);
			this.history.mem.buffer.push((this.data.mem.usedup + this.data.mem.cached + this.data.mem.buffer) / this.data.mem.total);

			GTop.glibtop_get_swap(this.swap.gtop);
			this.data.swap.total = this.swap.gtop.total;
			this.history.swap.push((this.data.swap.used = this.swap.gtop.used) / this.data.swap.total);

			let write = 0, read = 0;
			for(i = 0; i < this.data.mounts.length; ++i){
				GTop.glibtop_get_fsusage(this.disk.gtop, this.data.mounts[i].path);
				write += this.disk.gtop.write * this.disk.gtop.block_size;
				read += this.disk.gtop.read * this.disk.gtop.block_size;
			}
			if(delta > 0 && this.disk.write && this.disk.read){
				this.data.disk.write = (write - this.disk.write) / delta;
				this.data.disk.read = (read - this.disk.read) / delta;
				this.history.disk.write.push(this.data.disk.write);
				this.history.disk.read.push(this.data.disk.read);

				if(this.data.disk.max < this.data.disk.write) this.data.disk.max = this.data.disk.write;
				if(this.data.disk.max < this.data.disk.read) this.data.disk.max = this.data.disk.read;
			}

			this.disk.write = write;
			this.disk.read = read;

			let up = [0], down = [0];
			j = 1;
			for(i in this.network.dev){
				GTop.glibtop_get_netload(this.network.gtop, i);
				up[0] += up[j] = this.network.gtop.bytes_out * 8;
				down[0] += down[j] = this.network.gtop.bytes_in * 8;
				++j;
			}
			if(delta > 0 && this.network.up && this.network.down){
				for(i = 0, l = up.length; i < l; ++i){
					this.data.network.up[i] = this.network.up[i]? (up[i] - this.network.up[i]) / delta : 0;
					this.data.network.down[i] = this.network.down[i]? (down[i] - this.network.down[i]) / delta : 0;
				}
				this.history.network.up.push(this.data.network.up[0]);
				this.history.network.down.push(this.data.network.down[0]);

				if(this.data.network.max < this.data.network.up[0]) this.data.network.max = this.data.network.up[0];
				if(this.data.network.max < this.data.network.down[0]) this.data.network.max = this.data.network.down[0];
			}
			this.network.up = up;
			this.network.down = down;

			if(this.settings.thermalmode){
				r = GLib.spawn_command_line_sync(this.thermal.path)[1].toString().split("\n");
				this.data.thermal[0] = 0;
				for(i = 0, l = this.thermal.sensors.length; i < l; ++i){
					this.history.thermal[i + 1].push(this.data.thermal[i + 1] = parseFloat(r[this.thermal.sensors[i]].match(/\d+\.\d+/)));
					if(this.thermal.tmin > this.data.thermal[i + 1] || !this.thermal.tmin) this.thermal.tmin = this.data.thermal[i + 1];
					if(this.thermal.tmax < this.data.thermal[i + 1] || !this.thermal.tmax) this.thermal.tmax = this.data.thermal[i + 1];

					if(this.settings.thermalmode === 1 && this.data.thermal[0] > this.data.thermal[i + 1] || this.data.thermal[0] == 0) this.data.thermal[0] = this.data.thermal[i + 1];
					else if(this.settings.thermalmode === 2) this.data.thermal[0] += this.data.thermal[i + 1];
					else if(this.settings.thermalmode === 3 && this.data.thermal[0] < this.data.thermal[i + 1]) this.data.thermal[0] = this.data.thermal[i + 1];
				}
				if(this.settings.thermalmode === 2) this.data.thermal[0] /= l;
				this.history.thermal[0].push(this.data.thermal[0]);

				if(this.thermal.min > this.data.thermal[0] || !this.thermal.min) this.thermal.min = this.data.thermal[0];
				if(this.thermal.max < this.data.thermal[0] || !this.thermal.max) this.thermal.max = this.data.thermal[0];

				if(this.settings.thermalwarning && this.data.thermal[0] > this.settings.thermalwarningvalue){
					if(--this.notifications.thermal == 0)
						this.notify("Warning:", "Temperature was over " + this.formatthermal(this.settings.thermalwarningvalue) + " for " + this.settings.thermalwarningtime * this.settings.interval / 1000 + "sec");
				} else
					this.notifications.thermal = this.settings.thermalwarningtime;
			}

			if(this.menu.isOpen) this.refresh();
			this.timeout = Mainloop.timeout_add(this.settings.interval, Lang.bind(this, this.getData));
		} catch(e){
			global.logError(e);
		}
	},
	draw: function (){
		try {
			let ctx = this.canvas.get_context();
			let w = this.canvas.get_width();
			let h = this.canvas.get_height();
			var steps = this.settings.graphsteps;

			if(this.settings.graphtype == 0){
				function arc(angle, dir){
					if(dir) ctx.arc(w / 2, h / 2, r, a, a += angle);
					else ctx.arcNegative(w / 2, h / 2, r, a, a -= angle);
					ctx.stroke();
				}

				let dr = h / (this.cpu.count + 4) / 2;
				var r = dr, a;
				ctx.setLineWidth(dr);

				if(this.settings.thermalmode){
					ctx.setSourceRGB(this.colors.thermal[0], this.colors.thermal[1], this.colors.thermal[2]);
					ctx.arc(w / 2, h / 2, (this.data.thermal[0] - this.thermal.min) / (this.thermal.max - this.thermal.min) * dr, 0, Math.PI * 2);
					ctx.fill();
				}

				r += dr / 2;
				ctx.setSourceRGB(this.colors.read[0], this.colors.read[1], this.colors.read[2]);
				a = -Math.PI;
				arc(Math.PI * this.data.disk.read / this.data.disk.max / 2, false);
				a = 0;
				arc(Math.PI * this.data.network.down[0] / this.data.network.max / 2, true);
				ctx.setSourceRGB(this.colors.write[0], this.colors.write[1], this.colors.write[2]);
				a = -Math.PI;
				arc(Math.PI * this.data.disk.write / this.data.disk.max / 2, true);
				a = 0;
				arc(Math.PI * this.data.network.up[0] / this.data.network.max / 2, false);

				r += dr;
				a = -Math.PI / 2;
				for(let i = 0; i < this.cpu.count; ++i){
					ctx.setSourceRGB(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2]);
					arc(Math.PI * this.data.cpu.user[i] * 2, true);
					ctx.setSourceRGBA(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2], .75);
					arc(Math.PI * this.data.cpu.system[i] * 2, true);
					r += dr;
					a = -Math.PI / 2;
				}

				ctx.setSourceRGB(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2]);
				arc(Math.PI * this.data.mem.usedup / this.data.mem.total * 2, false);
				ctx.setSourceRGBA(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2], .75);
				arc(Math.PI * this.data.mem.cached / this.data.mem.total * 2, false);
				ctx.setSourceRGBA(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2], .5);
				arc(Math.PI * this.data.mem.buffer / this.data.mem.total * 2, false);

				r += dr;
				a = -Math.PI / 2;
				ctx.setSourceRGB(this.colors.swap[0], this.colors.swap[1], this.colors.swap[2]);
				arc(Math.PI * this.data.swap.used / this.data.swap.total * 2, false);
			} else if(this.settings.graphtype == 1){
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

				if(this.settings.thermalmode){
					ctx.setSourceRGB(this.colors.thermal[0], this.colors.thermal[1], this.colors.thermal[2]);
					ctx.arc(w / 2, h, (this.data.thermal[0] - this.thermal.min) / (this.thermal.max - this.thermal.min) * dr, Math.PI, 0);
					ctx.fill();
				}

				r += dr;

				ctx.setSourceRGB(this.colors.read[0], this.colors.read[1], this.colors.read[2]);
				quarterArc(Math.PI * this.data.network.down[0] / this.data.network.max / 2, this.settings.order);
				r += dr;
				quarterArc(Math.PI * this.data.disk.read / this.data.disk.max / 2, this.settings.order);

				ctx.setSourceRGB(this.colors.write[0], this.colors.write[1], this.colors.write[2]);
				r -= dr;
				quarterArc(Math.PI * this.data.network.up[0] / this.data.network.max / 2, !this.settings.order);
				r += dr;
				quarterArc(Math.PI * this.data.disk.write / this.data.disk.max / 2, !this.settings.order);

				r += dr;

				for(let i = 0; i < this.cpu.count; ++i){
					ctx.setSourceRGB(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2]);
					arc(Math.PI * this.data.cpu.user[i]);
					ctx.setSourceRGBA(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2], .75);
					arc(Math.PI * this.data.cpu.system[i]);
					r += dr;
					a = 0;
				}

				ctx.setSourceRGB(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2]);
				arc(Math.PI * this.data.mem.usedup / this.data.mem.total);
				ctx.setSourceRGBA(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2], .75);
				arc(Math.PI * this.data.mem.cached / this.data.mem.total);
				ctx.setSourceRGBA(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2], .5);
				arc(Math.PI * this.data.mem.buffer / this.data.mem.total);

				r += dr;
				a = 0;
				ctx.setSourceRGB(this.colors.swap[0], this.colors.swap[1], this.colors.swap[2]);
				arc(Math.PI * this.data.swap.used / this.data.swap.total);
			} else {
				if(this.settings.graphappearance === 0){
					function line(history, max, min){
						var l = history.length, tx = steps - l;
						ctx.moveTo(dw * tx, h - (history[0] - min) / (max - min) * h);
						for(var i = 1; i < l; ++i)
							ctx.lineTo(dw * (i + tx), h - (history[i] - min) / (max - min) * h);
						ctx.stroke();
					}
				} else if(this.settings.graphappearance === 1){
				function line(history, max, min){
						var l = history.length, tx = steps - l;
						ctx.moveTo(dw * tx, h - (history[0] - min) / (max - min) * h);
						for(var i = 1; i < l; ++i)
							ctx.curveTo(dw * (i + tx - .5), h - (history[i - 1] - min) / (max - min) * h, dw * (i + tx - .5), h - (history[i] - min) / (max - min) * h, dw * (i + tx), h - (history[i] - min) / (max - min) * h);
						ctx.stroke();
					}
				} else {
					function line(history, max, min, num, total){
						var l = history.length, tx = steps - l;
						for(var i = 1; i < l; ++i)
							ctx.rectangle(dw * (i + tx) + dw * num / total, h, dw / total, -(history[i] - min) / (max - min) * h);
						ctx.fill();
					}
				}

				var dw = w / steps;

				if(this.settings.graphtype == 2){
					for(let i = 0; i < this.cpu.count; ++i){
						ctx.setSourceRGB(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2]);
						line(this.history.cpu.user[i], 1, 0, i, this.cpu.count);
						ctx.setSourceRGBA(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2], .75);
						line(this.history.cpu.system[i], 1, 0, i, this.cpu.count);
					}
				} else if(this.settings.graphtype == 3){
					ctx.setSourceRGB(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2]);
					line(this.history.mem.usedup, 1, 0, 0, 2);
					ctx.setSourceRGBA(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2], .75);
					line(this.history.mem.cached, 1, 0, 0, 2);
					ctx.setSourceRGBA(this.colors.mem[0], this.colors.mem[1], this.colors.mem[2], .5);
					line(this.history.mem.buffer, 1, 0, 0, 2);

					ctx.setSourceRGB(this.colors.swap[0], this.colors.swap[1], this.colors.swap[2]);
					line(this.history.swap, 1, 0, 1, 2);
				} else if(this.settings.graphtype == 4){
					var dw = w / steps;
					ctx.setSourceRGB(this.colors.write[0], this.colors.write[1], this.colors.write[2]);
					line(this.history.disk.write, this.data.disk.max, 0, 0, 2);

					ctx.setSourceRGB(this.colors.read[0], this.colors.read[1], this.colors.read[2]);
					line(this.history.disk.read, this.data.disk.max, 0, 1, 2);
				} else if(this.settings.graphtype == 5){
					var dw = w / steps;
					ctx.setSourceRGB(this.colors.write[0], this.colors.write[1], this.colors.write[2]);
					line(this.history.network.up, this.data.network.max, 0, 0, 2);

					ctx.setSourceRGB(this.colors.read[0], this.colors.read[1], this.colors.read[2]);
					line(this.history.network.down, this.data.network.max, 0, 1, 2);
				} else if(this.settings.graphtype == 6){
					var dw = w / steps, i, l = this.history.thermal.length;

					for(i = 1; i < l; ++i){
						if(this.thermal.colors[i]) ctx.setSourceRGBA(this.colors["cpu" + this.thermal.colors[i]][0], this.colors["cpu" + this.thermal.colors[i]][1], this.colors["cpu" + this.thermal.colors[i]][2], 1);
						else ctx.setSourceRGBA(this.colors.thermal[0], this.colors.thermal[1], this.colors.thermal[2], (l - i / 4) / l);
						line(this.history.thermal[i], this.thermal.tmax, this.thermal.tmin, i, l);
					}

					ctx.setSourceRGB(this.colors.thermal[0], this.colors.thermal[1], this.colors.thermal[2]);
					ctx.setDash([5, 5], 0);
					line(this.history.thermal[0], this.thermal.tmax, this.thermal.tmin, 0, l);
				}
			}
		} catch(e){
			global.logError(e);
		}
	},
	refresh: function(){
		try {
			let i, l;
			for(i = 0; i < this.cpu.count; ++i){
				this.cpu.container[0].get_children()[i].set_text(this.formatpercent(this.data.cpu.usage[i]));
				this.cpu.container[1].get_children()[i].set_text(this.formatpercent(this.data.cpu.user[i]));
				this.cpu.container[2].get_children()[i].set_text(this.formatpercent(this.data.cpu.system[i]));
			}

			this.mem.container[0].get_children()[0].set_text(this.formatbytes(this.data.mem.used));
			this.mem.container[0].get_children()[1].set_text(this.formatbytes(this.data.mem.total));
			this.mem.container[0].get_children()[2].set_text(this.formatpercent(this.data.mem.used, this.data.mem.total));
			this.mem.container[1].get_children()[0].set_text(this.formatbytes(this.data.mem.usedup));
			this.mem.container[1].get_children()[1].set_text(this.formatpercent(this.data.mem.usedup, this.data.mem.total));
			this.mem.container[2].get_children()[0].set_text(this.formatbytes(this.data.mem.cached));
			this.mem.container[2].get_children()[1].set_text(this.formatpercent(this.data.mem.cached, this.data.mem.total));
			this.mem.container[3].get_children()[0].set_text(this.formatbytes(this.data.mem.buffer));
			this.mem.container[3].get_children()[1].set_text(this.formatpercent(this.data.mem.buffer, this.data.mem.total));

			this.swap.container[0].get_children()[0].set_text(this.formatbytes(this.data.swap.used));
			this.swap.container[0].get_children()[1].set_text(this.formatbytes(this.data.swap.total));
			this.swap.container[0].get_children()[2].set_text(this.formatpercent(this.data.swap.used, this.data.swap.total));

			this.disk.container[0].get_children()[this.settings.order? 0 : 1].set_text(this.formatrate(this.data.disk.write) + " \u25B2");
			this.disk.container[0].get_children()[this.settings.order? 1 : 0].set_text(this.formatrate(this.data.disk.read) + " \u25BC");
			for(i = 0; i < this.data.mounts.length; ++i){
				this.disk.container[i + 1].get_children()[0].set_text(this.formatbytes((this.data.mounts[i].blocks - this.data.mounts[i].free) * this.data.mounts[i].size));
				this.disk.container[i + 1].get_children()[1].set_text(this.formatbytes(this.data.mounts[i].blocks * this.data.mounts[i].size));
				this.disk.container[i + 1].get_children()[2].set_text(this.formatpercent(this.data.mounts[i].blocks - this.data.mounts[i].free, this.data.mounts[i].blocks));
			}

			for(i = 0, l = this.data.network.up.length; i < l; ++i){
				this.network.container[i].get_children()[this.settings.order? 0 : 1].set_text(this.formatrate(this.data.network.up[i]) + " \u25B2");
				this.network.container[i].get_children()[this.settings.order? 1 : 0].set_text(this.formatrate(this.data.network.down[i]) + " \u25BC");
			}
			this.network.container[i].get_children()[this.settings.order? 0 : 1].set_text(this.formatbytes(this.network.up[0]) + " \u25B2");
			this.network.container[i].get_children()[this.settings.order? 1 : 0].set_text(this.formatbytes(this.network.down[0]) + " \u25BC");

			for(i = 0, l = this.data.thermal.length; i < l; ++i)
				this.thermal.container[i].get_children()[0].set_text(this.formatthermal(this.data.thermal[i]));

			this.canvas.queue_repaint();
		} catch(e){
			global.logError(e);
		}
	},
	notify: function(summary, body){
		Util.spawnCommandLine("notify-send -i utilities-system-monitor " + summary + " '" + body + "'");
	},
	formatbytes: function(bytes){
		let prefix = " KMGTPEZY";
		let a = 1, j = 0;
		while(bytes / a > this.settings.maxsize){
			a *= this.settings.byteunit? 1024 : 1000;
			++j;
		}
		return (bytes / a).toFixed(1) + " " + prefix[j] + (this.settings.byteunit && j? "i" : "") + "B";
	},
	formatrate: function(bytes){
		let prefix = " KMGTPEZY";
		let a = (this.settings.rateunit < 2? 1 : .125), j = 0;
		while(bytes / a > this.settings.maxsize){
			a *= this.settings.rateunit & 1? 1024 : 1000;
			++j;
		}
		return (bytes / a).toFixed(1) + " " + prefix[j] + (this.settings.rateunit & 1 && j? "i" : "") + (this.settings.rateunit < 2? "B" : "bit") + "/s";
	},
	formatpercent: function(part, total){
		return (100 * part / (total || 1)).toFixed(1) + "%";
	},
	formatthermal: function(celsius){
		return (this.settings.thermalunit? celsius : celsius * 1.8 + 32).toFixed(1) + "\u00b0" + (this.settings.thermalunit? "C" : "F");
	},
	on_applet_clicked: function(){
		this.menu.toggle();
		if(this.menu.isOpen) this.refresh();
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
			this.canvas.set_height(this.settings.graphsize);
			if(this.settings.cpuwarning){
				if(this.settings.cpuwarningmode)
					this.notifications.cpu = this.settings.cpuwarningtime;
				else {
					this.notifications.cpu = [];
					for(var i = 0; i < this.cpu.count; ++i)
						this.notifications.cpu.push(this.settings.cpuwarningtime);
				}
			}
			if(this.settings.thermalwarning){
				this.notifications.thermal = this.settings.thermalwarningtime;
				if(!this.settings.thermalunit) this.settings.thermalwarningvalue = (this.settings.thermalwarningvalue - 32) * 5 / 9; //Fahrenheit => Celsius
			}
		} catch(e){
			global.logError(e);
		}
	}
};

function main(metadata, orientation, panelHeight, instanceId){
	let myApplet = new MyApplet(metadata, orientation, instanceId);
	return myApplet;
}
