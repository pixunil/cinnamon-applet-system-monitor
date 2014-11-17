const GLib = imports.gi.GLib;

function Base(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
Base.prototype = {
	_init: function(canvas, modules, settings, colors){
		this.canvas = canvas;
		this.modules = modules;
		this.settings = settings;
		this.colors = colors;
	},

	begin: function(){
		this.ctx = this.canvas.get_context();
		this.w = this.canvas.get_width();
		this.h = this.canvas.get_height();
	},

	setColor: function(c){
		this.color = c;
		c = this.colors[c];
		this.ctx.setSourceRGB(c[0], c[1], c[2]);
	},
	setAlpha: function(a){
		var c = this.colors[this.color];
		this.ctx.setSourceRGBA(c[0], c[1], c[2], a);
	}
};

function Pie(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
Pie.prototype = {
	__proto__: Base.prototype,

	begin: function(n){
		Base.prototype.begin.call(this);

		this.dr = this.h / n / 2;
		this.r = this.dr * 1.5;
		this.ctx.setLineWidth(this.dr);
	},

	draw: function(){
		let m = this.modules;
		this.begin(m.cpu.count + 4);

		if(this.settings.thermalMode){
			this.setColor("thermal");
			this.circle((m.thermal.data[0] - m.thermal.min) / (m.thermal.max - m.thermal.min));
		}

		this.setColor("read");
		this.quarterArc(m.disk.data.read / m.disk.max, false, false);
		this.quarterArc(m.network.data.down[0] / m.network.max, true, true);

		this.setColor("write");
		this.quarterArc(m.disk.data.write / m.disk.max, false, true);
		this.quarterArc(m.network.data.up[0] / m.network.max, true, false);

		for(let i = 0; i < m.cpu.count; ++i){
			this.next("cpu" + (i % 4 + 1));
			this.arc(m.cpu.data.user[i], true);
			this.setAlpha(.75);
			this.arc(m.cpu.data.system[i], true);
		}

		this.next("mem");
		this.arc(m.mem.data.usedup / m.mem.data.total, false);
		this.setAlpha(.75);
		this.arc(m.mem.data.cached / m.mem.data.total, false);
		this.setAlpha(.5);
		this.arc(m.mem.data.buffer / m.mem.data.total, false);

		this.next("swap");
		this.arc(m.swap.data.used / m.swap.data.total, false);
	},

	next: function(color){
		this.a = -Math.PI / 2;
		this.r += this.dr;
		this.setColor(color);
	},

	arc: function(angle, dir){
		angle *= Math.PI * 2;
		if(dir)
			this.ctx.arc(this.w / 2, this.h / 2, this.r, this.a, this.a += angle);
		else
			this.ctx.arcNegative(this.w / 2, this.h / 2, this.r, this.a, this.a -= angle);
		this.ctx.stroke();
	},
	quarterArc: function(angle, side, dir){
		var a = side? 0 : -Math.PI;
		angle *= Math.PI / 2;

		if(dir)
			this.ctx.arc(this.w / 2, this.h / 2, this.r, a, a + angle);
		else
			this.ctx.arcNegative(this.w / 2, this.h / 2, this.r, a, a - angle);
		this.ctx.stroke();
	},
	circle: function(radius){
		this.ctx.arc(this.w / 2, this.h / 2, radius * this.dr, 0, Math.PI * 2);
		this.ctx.fill();
	}
};

function Arc(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
Arc.prototype = {
	__proto__: Base.prototype,

	begin: function(n){
		Base.prototype.begin.call(this);

		this.dr = Math.min(this.w / n / 2, this.h / n);
		this.r = this.dr;
		this.ctx.setLineWidth(this.dr);
	},

	draw: function(){
		let m = this.modules;
		this.begin(m.cpu.count + 5);

		if(this.settings.thermalMode){
			this.setColor("thermal");
			this.halfCircle((m.thermal.data[0] - m.thermal.min) / (m.thermal.max - m.thermal.min));
		}

		this.r -= this.dr / 2;

		this.next("read");
		this.quarterArc(m.disk.data.read / m.disk.max, this.settings.order);
		this.setColor("write");
		this.quarterArc(m.disk.data.write / m.disk.max, !this.settings.order);

		this.next("read");
		this.quarterArc(m.network.data.down[0] / m.network.max, this.settings.order);
		this.setColor("write");
		this.quarterArc(m.network.data.up[0] / m.network.max, !this.settings.order);

		for(let i = 0; i < m.cpu.count; ++i){
			this.next("cpu" + (i % 4 + 1));
			this.arc(m.cpu.data.user[i]);
			this.setAlpha(.75);
			this.arc(m.cpu.data.system[i]);
		}

		this.next("mem");
		this.arc(m.mem.data.usedup / m.mem.data.total);
		this.setAlpha(.75);
		this.arc(m.mem.data.cached / m.mem.data.total);
		this.setAlpha(.5);
		this.arc(m.mem.data.buffer / m.mem.data.total);

		this.next("swap");
		this.arc(m.swap.data.used / m.swap.data.total);
	},

	next: function(color){
		this.a = 0;
		this.r += this.dr;
		this.setColor(color);
	},

	arc: function(angle){
		angle *= Math.PI / 2;
		if(this.a === 0){
			this.a = angle;
			this.ctx.arc(this.w / 2, this.h, this.r, -this.a - Math.PI / 2, this.a - Math.PI / 2);
		} else {
			this.ctx.arc(this.w / 2, this.h, this.r, this.a - Math.PI / 2, this.a + angle - Math.PI / 2);
			this.ctx.stroke();
			this.ctx.arcNegative(this.w / 2, this.h, this.r, -this.a - Math.PI / 2, -this.a - angle - Math.PI / 2);
			this.a += angle;
		}
		this.ctx.stroke();
	},
	quarterArc: function(angle, dir){
		angle *= Math.PI / 2;

		if(dir)
			this.ctx.arc(this.w / 2, this.h, this.r, -Math.PI / 2, angle - Math.PI / 2);
		else
			this.ctx.arcNegative(this.w / 2, this.h, this.r, -Math.PI / 2, -angle - Math.PI / 2);
		this.ctx.stroke();
	},
	halfCircle: function(radius){
		this.ctx.arc(this.w / 2, this.h, radius * this.r, -Math.PI, Math.PI);
		this.ctx.fill();
	}
};

function Bar(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
Bar.prototype = {
	__proto__: Base.prototype,

	begin: function(n){
		Base.prototype.begin.call(this);

		this.dx = this.w / n;
		this.x = -this.dx;
	},
	next: function(color){
		this.x += this.dx;
		this.y = this.h;
		this.setColor(color);
	},

	bar: function(size){
		this.ctx.rectangle(this.x, this.y, this.dx, -size * this.h);
		this.ctx.fill();
		this.y -= size * this.h;
	}
};

function History(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
History.prototype = {
	__proto__: Base.prototype,

	_line: {
		line: function(history){
			this.ctx.moveTo(this.dw * this.tx, this.h - (history[0] - this.min) / (this.max - this.min) * this.h);
			this.connection(history, 1);
			this.ctx.stroke();
		},
		area:	function(history, num, total){
			if(this.packDir){
				this.ctx.translate(0, this.h * num / total);
				this.ctx.scale(1, 1 / total);
			} else {
				this.ctx.translate(this.w * num / total, 0);
				this.ctx.scale(1 / total, 1);
				this.ctx.rectangle(0, 0, this.w, this.h);
				this.ctx.clip();
			}

			this.ctx.moveTo(this.dw * this.tx, this.h);
			this.ctx.lineTo(this.dw * this.tx, this.h - (history[0] - this.min) / (this.max - this.min) * this.h);
			this.connection(history, 1);
			this.ctx.lineTo(this.dw * (history.length - 1 + this.tx), this.h);
			this.ctx.fill();

			this.ctx.identityMatrix();
		},
		bar:	function(history, num, total){
			var l = history.length;
			for(var i = 0; i < l; ++i)
				this.ctx.rectangle(this.dw * (i + this.tx) + this.dw * num / total, this.h, this.dw / total, -(history[i] - this.min) / (this.max - this.min) * this.h);
			this.ctx.fill();
		}
	},
	_connection: {
		line:	function(history, i){
			for(var l = history.length; i < l; ++i)
				this.ctx.lineTo(this.dw * (i + this.tx), this.h - (history[i] - this.min) / (this.max - this.min) * this.h);
		},
		straight:	function(history, i){
			for(var l = history.length; i < l; ++i){
				this.ctx.lineTo(this.dw * (i + this.tx - .5), this.h - (history[i - 1] - this.min) / (this.max - this.min) * this.h);
				this.ctx.lineTo(this.dw * (i + this.tx - .5), this.h - (history[i] - this.min) / (this.max - this.min) * this.h);
				this.ctx.lineTo(this.dw * (i + this.tx), this.h - (history[i] - this.min) / (this.max - this.min) * this.h);
			}
		},
		curve:	function(history, i){
			for(var l = history.length; i < l; ++i)
				this.ctx.curveTo(this.dw * (i + this.tx - .5), this.h - (history[i - 1] - this.min) / (this.max - this.min) * this.h, this.dw * (i + this.tx - .5), this.h - (history[i] - this.min) / (this.max - this.min) * this.h, this.dw * (i + this.tx), this.h - (history[i] - this.min) / (this.max - this.min) * this.h);
		}
	},

	packDir: true,

	begin: function(t, n, max, min){
		Base.prototype.begin.call(this);

		this.dw = this.w / this.settings.graphSteps;
		var deltaT = (GLib.get_monotonic_time() / 1e3 - t * 1e3) / this.settings.interval;
		this.tx = this.settings.graphSteps + 2 - deltaT - n;

		this.min = min || 0;
		this.max = max || 1;

		this.line = this._line[this.settings.graphAppearance];
		if(!this.line) this.line = this._line.line;
		this.connection = this._connection[this.settings.graphConnection];
		if(!this.connection) this.connection = this._connection.line;
	}
};

function CPUBar(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
CPUBar.prototype = {
	__proto__: Bar.prototype,

	draw: function(){
		let m = this.modules;

		this.begin(m.cpu.count);

		for(let i = 0; i < m.cpu.count; ++i){
			this.next("cpu" + (i % 4 + 1));
			this.bar(m.cpu.data.user[i]);
			this.setAlpha(.75);
			this.bar(m.cpu.data.system[i]);
		}
	}
};

function CPUHistory(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
CPUHistory.prototype = {
	__proto__: History.prototype,

	draw: function(){
		let m = this.modules;

		this.begin(m.time[0], m.cpu.history.user[0].length);

		for(let i = 0; i < m.cpu.count; ++i){
			this.setColor("cpu" + (i % 4 + 1));
			this.line(m.cpu.history.user[i], i, m.cpu.count);
			this.setAlpha(.75);
			this.line(m.cpu.history.system[i], i, m.cpu.count);
		}
	}
};

function MemoryBar(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
MemoryBar.prototype = {
	__proto__: Bar.prototype,

	draw: function(){
		let m = this.modules;

		this.begin(1);

		this.next("mem");
		this.bar(m.mem.data.usedup / m.mem.data.total);
		this.setAlpha(.75);
		this.bar(m.mem.data.cached / m.mem.data.total);
		this.setAlpha(.5);
		this.bar(m.mem.data.buffer / m.mem.data.total);
	}
};

function MemoryHistory(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
MemoryHistory.prototype = {
	__proto__: History.prototype,

	draw: function(){
		let m = this.modules;
		this.begin(m.time[0], m.mem.history.usedup.length);

		this.setColor("mem");
		this.line(m.mem.history.usedup, 0, 1);
		this.setAlpha(.75);
		this.line(m.mem.history.cached, 0, 1);
		this.setAlpha(.5);
		this.line(m.mem.history.buffer, 0, 1);
	}
};

function MemorySwapBar(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
MemorySwapBar.prototype = {
	__proto__: Bar.prototype,

	draw: function(){
		let m = this.modules;

		this.begin(2);

		this.next("mem");
		this.bar(m.mem.data.usedup / m.mem.data.total);
		this.setAlpha(.75);
		this.bar(m.mem.data.cached / m.mem.data.total);
		this.setAlpha(.5);
		this.bar(m.mem.data.buffer / m.mem.data.total);

		this.next("swap");
		this.bar(m.swap.data.used / m.swap.data.total);
	}
};

function MemorySwapHistory(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
MemorySwapHistory.prototype = {
	__proto__: History.prototype,

	draw: function(){
		let m = this.modules;
		this.begin(m.time[0], m.mem.history.usedup.length);

		this.setColor("mem");
		this.line(m.mem.history.usedup, 0, 2);
		this.setAlpha(.75);
		this.line(m.mem.history.cached, 0, 2);
		this.setAlpha(.5);
		this.line(m.mem.history.buffer, 0, 2);

		this.setColor("swap");
		this.line(m.swap.history, 1, 2);
	}
};

function DiskBar(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
DiskBar.prototype = {
	__proto__: Bar.prototype,

	draw: function(){
		let m = this.modules;

		this.begin(2);

		this.next("read");
		this.bar(m.disk.data.read / m.disk.max);

		this.next("write");
		this.bar(m.disk.data.write / m.disk.max);
	}
};

function DiskHistory(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
DiskHistory.prototype = {
	__proto__: History.prototype,

	draw: function(){
		let m = this.modules;
		this.begin(m.time[0], m.disk.history.write.length, m.disk.max);

		this.setColor("write");
		this.line(m.disk.history.write, 0, 2);

		this.setColor("read");
		this.line(m.disk.history.read, 1, 2);
	}
};

function NetworkBar(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
NetworkBar.prototype = {
	__proto__: Bar.prototype,

	draw: function(){
		let m = this.modules;

		this.begin(2);

		this.next("read");
		this.bar(m.network.data.down[0] / m.network.max);

		this.next("write");
		this.bar(m.network.data.up[0] / m.network.max);
	}
};

function NetworkHistory(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
NetworkHistory.prototype = {
	__proto__: History.prototype,

	draw: function(){
		let m = this.modules;
		this.begin(m.time[0], m.network.history.up.length, m.network.max);

		this.setColor("write");
		this.line(m.network.history.up, 0, 2);

		this.setColor("read");
		this.line(m.network.history.down, 1, 2);
	}
};

function ThermalBar(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
ThermalBar.prototype = {
	__proto__: Bar.prototype,

	draw: function(){
		let m = this.modules;

		this.begin(1);

		this.setColor("thermal");
		this.bar((m.thermal.data[0] - m.thermal.min) / (m.thermal.max - m.thermal.min));
	}
};

function ThermalHistory(canvas, modules, settings, colors){
	this._init(canvas, modules, settings, colors);
}
ThermalHistory.prototype = {
	__proto__: History.prototype,

	draw: function(){
		let m = this.modules;
		this.begin(m.time[1], m.thermal.history[0].length, m.thermal.max, m.thermal.min);

		for(var i = 1, l = m.thermal.history.length; i < l; ++i){
			if(m.thermal.colors[i])
				this.setColor("cpu" + m.thermal.colors[i]);
			else {
				this.setColor("thermal");
				this.setAlpha((l - i / 4) / l);
			}
			this.line(m.thermal.history[i], i, l);
		}

		this.setColor("thermal");
		this.ctx.setDash([5, 5], 0);
		this.line(m.thermal.history[0], 0, l);
	}
};
