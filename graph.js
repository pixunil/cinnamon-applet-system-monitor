const Cairo = imports.cairo;

const GLib = imports.gi.GLib;

function Base(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
Base.prototype = {
    _init: function(canvas, modules, time, settings, colors){
        this.canvas = canvas;
        this.modules = modules;
        this.time = time;
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


function Overview(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
Overview.prototype = {
    __proto__: Base.prototype,

    xScale: .5,
    yScale: .5,

    draw: function(){
        let m = this.modules;
        this.begin();

        if(this.settings.thermal){
            this.next("thermal");
            this.center((m.thermal.data[0] - m.thermal.min) / (m.thermal.max - m.thermal.min));
        }

        if(this.settings.disk){
            this.next("write");
            this.small(m.disk.data.write / m.disk.max, true, false);
            this.setColor("read");
            this.small(m.disk.data.read / m.disk.max, false, false);
        }

        if(this.settings.network){
            if(!this.smallMerged)
                this.next("up");
            else
                this.setColor("up");
            this.small(m.network.data.up / m.network.max, true, true);
            this.setColor("down");
            this.small(m.network.data.down / m.network.max, false, true);
        }

        if(this.settings.cpu){
            for(let i = 0; i < m.cpu.count; ++i){
                this.next("cpu" + (i % 4 + 1));
                this.normal(m.cpu.data.user[i], true);
                this.setAlpha(.75);
                this.normal(m.cpu.data.system[i], true);
            }
        }

        if(this.settings.mem){
            this.next("mem");
            this.normal(m.mem.data.usedup / m.mem.data.total, false);
            this.setAlpha(.75);
            this.normal(m.mem.data.cached / m.mem.data.total, false);
            this.setAlpha(.5);
            this.normal(m.mem.data.buffer / m.mem.data.total, false);

            this.next("swap");
            this.normal(m.swap.data.used / m.swap.data.total, false);
        }
    },

    begin: function(){
        Base.prototype.begin.call(this);

        let count = {
            center: 0,
            small: 0,
            normal: 0
        };

        if(this.settings.thermal)
            count.center++;
        if(this.settings.disk)
            count.small++;
        if(this.settings.network)
            count.small++;
        if(this.settings.cpu)
            count.normal += this.modules.cpu.count;
        if(this.settings.mem)
            count.normal += 2;

        if(this.smallMerged && count.small)
            count.small = 1;
        let n = count.center + count.small + count.normal;

        this.dr = Math.min(this.w / n * this.xScale, this.h / n * this.yScale);
        this.r = -this.dr / 2;
        this.ctx.setLineWidth(this.dr);
    },

    next: function(color){
        this.a = this.startA;
        this.r += this.dr;
        this.setColor(color);
    }
};


function PieOverview(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
PieOverview.prototype = {
    __proto__: Overview.prototype,

    startA: -Math.PI / 2,
    smallMerged: true,

    normal: function(angle, dir){
        angle *= Math.PI * 2;
        if(dir)
            this.ctx.arc(this.w / 2, this.h / 2, this.r, this.a, this.a += angle);
        else
            this.ctx.arcNegative(this.w / 2, this.h / 2, this.r, this.a, this.a -= angle);
        this.ctx.stroke();
    },
    small: function(angle, dir, side){
        var a = -Math.PI;
        if(side){
            a = 0;
            dir = !dir;
        }
        angle *= Math.PI / 2;

        if(dir)
            this.ctx.arc(this.w / 2, this.h / 2, this.r, a, a + angle);
        else
            this.ctx.arcNegative(this.w / 2, this.h / 2, this.r, a, a - angle);
        this.ctx.stroke();
    },
    center: function(radius){
        this.ctx.arc(this.w / 2, this.h / 2, radius * this.dr, 0, Math.PI * 2);
        this.ctx.fill();
    }
};

function ArcOverview(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
ArcOverview.prototype = {
    __proto__: Overview.prototype,

    startA: 0,
    yScale: 1,

    normal: function(angle){
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
    small: function(angle, dir){
        angle *= Math.PI / 2;

        if(dir)
            this.ctx.arc(this.w / 2, this.h, this.r, -Math.PI / 2, angle - Math.PI / 2);
        else
            this.ctx.arcNegative(this.w / 2, this.h, this.r, -Math.PI / 2, -angle - Math.PI / 2);
        this.ctx.stroke();
    },
    center: function(radius){
        this.ctx.arc(this.w / 2, this.h, radius * this.dr, -Math.PI, Math.PI);
        this.ctx.fill();
    }
};

function Bar(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
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

function History(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
History.prototype = {
    __proto__: Base.prototype,

    _line: {
        line: function(history){
            this.ctx.translate(this.dw * this.tx, this.h);
            this.ctx.scale(this.dw, -this.h / (this.max - this.min));
            this.ctx.translate(0, -this.min);

            this.ctx.moveTo(0, history[0] + (this.last[0] || 0));
            this.connection(history, 1);
            this.ctx.identityMatrix();
            this.ctx.stroke();

            this._incrementLast(history);
        },
        area: function(history, num, total){
            this.ctx.save();
            if(this.packDir){
                this.ctx.translate(this.dw * this.tx, this.h - (this.h * num / total));
                this.ctx.scale(this.dw, -this.h / (this.max - this.min) / total);
                this.ctx.translate(0, -this.min);
            } else {
                this.ctx.rectangle(this.w * num / total, 0, this.w / total, this.h);
                this.ctx.clip();
                this.ctx.translate(this.w * num / total + this.dw * this.tx / total, this.h);
                this.ctx.scale(this.dw / total, -this.h / (this.max - this.min));
                this.ctx.translate(0, -this.min);
            }

            this.ctx.moveTo(0, history[0] + (this.last[0] || 0));
            this.connection(history, 1, true);
            if(!this.last.length)
                this.ctx.lineTo(history.length - 1, (this.last[history.length - 1] || 0) + this.min);
            this.ctx.lineTo(0, (this.last[0] || 0) + this.min);
            this.ctx.fill();
            this.ctx.restore();

            this._incrementLast(history);
        },
        areaUpDown: function(history, num){
            this.ctx.save();
            if(this.packDir){
                this.ctx.translate(this.dw * this.tx, this.h / 2);
                if(!num) //up
                    this.ctx.scale(this.dw, -this.h / (this.max - this.min) / 2);
                else //down
                    this.ctx.scale(this.dw, this.h / (this.max - this.min) / 2);
                this.ctx.translate(0, -this.min);
            } else {
                this.ctx.rectangle(num? 0 : this.w / 2, 0, this.w / 2, this.h);
                this.ctx.clip();
                this.ctx.translate((num? 0 : this.w / 2) + this.dw * this.tx / 2, this.h);
                this.ctx.scale(this.dw / 2, -this.h / (this.max - this.min));
                this.ctx.translate(0, -this.min);
            }

            this.ctx.moveTo(0, history[0] + (this.last[0] || 0));
            this.connection(history, 1, true);
            if(!this.last.length)
                this.ctx.lineTo(history.length - 1, (this.last[history.length - 1] || 0) + this.min);
            this.ctx.lineTo(0, (this.last[0] || 0) + this.min);
            this.ctx.fill();
            this.ctx.restore();

            this._incrementLast(history);
        },
        stack: function(history, num, total){
            this.ctx.save();
            this.ctx.translate(this.dw * this.tx, this.h);
            this.ctx.scale(this.dw, -this.h / (this.max - this.min) / total);
            this.ctx.translate(0, -this.min);

            this.ctx.moveTo(0, history[0] + (this.last[0] || 0));
            this.connection(history, 1, true);
            if(!this.last.length)
                this.ctx.lineTo(history.length - 1, (this.last[history.length - 1] || 0) + this.min);
            this.ctx.lineTo(0, (this.last[0] || 0) + this.min);
            this.ctx.fill();
            this.ctx.restore();

            this._incrementLast(history);
        },
        bar: function(history, num, total){
            var l = history.length;
            for(var i = 0; i < l; ++i){
                this.ctx.rectangle(this.dw * (i + this.tx) + this.dw * num / total, this.h, this.dw / total, -(history[i] + (this.last[i] || 0) - this.min) / (this.max - this.min) * this.h);
                this.last[i] = history[i] + (this.last[i] || 0) - this.min;
            }
            this.ctx.fill();
        }
    },
    _connection: {
        line: function(history, i, back){
            for(var l = history.length; i < l; ++i)
                this.ctx.lineTo(i, history[i] + (this.last[i] || 0));

            if(this.last.length && back){
                for(--i; i >= 0; --i)
                    this.ctx.lineTo(i, this.last[i]);
            }
        },
        straight: function(history, i, back){
            for(var l = history.length; i < l; ++i){
                this.ctx.lineTo(i - .5, history[i - 1] + (this.last[i - 1] || 0));
                this.ctx.lineTo(i - .5, history[i] + (this.last[i] || 0));
                this.ctx.lineTo(i, history[i] + (this.last[i] || 0));
            }
            if(this.last.length && back){
                this.ctx.lineTo(--i, this.last[i]);
                for(--i; i >= 0; --i){
                    this.ctx.lineTo(i + .5, this.last[i + 1]);
                    this.ctx.lineTo(i + .5, this.last[i]);
                    this.ctx.lineTo(i, this.last[i]);
                }
            }
        },
        curve: function(history, i, back){
            for(var l = history.length; i < l; ++i)
                this.ctx.curveTo(i - .5, history[i - 1] + (this.last[i - 1] || 0), i - .5, history[i] + (this.last[i] || 0), i, history[i] + (this.last[i] || 0));

            if(this.last.length && back){
                this.ctx.lineTo(--i, this.last[i]);
                for(--i; i >= 0; --i)
                    this.ctx.curveTo(i + .5, this.last[i + 1], i + .5, this.last[i], i, this.last[i]);
            }
        }
    },
    _incrementLast: function(history){
        for(var i = 0, l = history.length; i < l; ++i)
            this.last[i] = history[i] + (this.last[i] || 0);
    },

    packDir: true,

    begin: function(n, t, max, min){
        Base.prototype.begin.call(this);

        this.dw = this.w / this.settings.graphSteps;
        t = this.time[t || 0];
        var deltaT = (GLib.get_monotonic_time() / 1e3 - t * 1e3) / this.settings.interval;
        this.tx = this.settings.graphSteps + 2 - deltaT - n;

        this.min = min || 0;
        this.max = max || 1;

        this.line = this._line[this.settings[this.name + "Appearance"]];
        if(!this.line)
            this.line = this._line.line;
        if(this.settings[this.name + "Appearance"] === "line")
            this.ctx.setLineJoin(Cairo.LineJoin.ROUND);

        this.connection = this._connection[this.settings.graphConnection];
        if(!this.connection)
            this.connection = this._connection.line;

        this.last = [];
    },
    next: function(color){
        this.setColor(color);
        if(this.settings[this.name + "Appearance"] !== "stack")
            this.last = [];
    }
};

function CPUBar(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
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

function CPUHistory(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
CPUHistory.prototype = {
    __proto__: History.prototype,

    name: "cpu",

    draw: function(){
        let m = this.modules;

        this.begin(m.cpu.history.user[0].length);

        for(let i = 0; i < m.cpu.count; ++i){
            this.next("cpu" + (i % 4 + 1));
            if(this.settings.cpuSplit){
                this.line(m.cpu.history.user[i], i, m.cpu.count);
                this.setAlpha(.75);
                this.line(m.cpu.history.system[i], i, m.cpu.count);
            } else
                this.line(m.cpu.history.usage[i], i, m.cpu.count);
        }
    }
};

function MemoryBar(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
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

function MemoryHistory(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
MemoryHistory.prototype = {
    __proto__: History.prototype,

    name: "mem",

    draw: function(){
        let m = this.modules;
        this.begin(m.mem.history.usedup.length, 0, m.mem.data.total);

        this.next("mem");
        this.line(m.mem.history.usedup, 0, 1);
        this.setAlpha(.75);
        this.line(m.mem.history.cached, 0, 1);
        this.setAlpha(.5);
        this.line(m.mem.history.buffer, 0, 1);
    }
};

function MemorySwapBar(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
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

function MemorySwapHistory(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
MemorySwapHistory.prototype = {
    __proto__: History.prototype,

    name: "mem",

    draw: function(){
        let m = this.modules;
        this.begin(m.mem.history.usedup.length, 0, m.mem.data.total);

        this.next("mem");
        this.line(m.mem.history.usedup, 0, 2);
        this.setAlpha(.75);
        this.line(m.mem.history.cached, 0, 2);
        this.setAlpha(.5);
        this.line(m.mem.history.buffer, 0, 2);

        this.max = m.swap.data.total;

        this.next("swap");
        this.line(m.swap.history, 1, 2);
    }
};

function DiskBar(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
DiskBar.prototype = {
    __proto__: Bar.prototype,

    draw: function(){
        let m = this.modules;

        this.begin(2);

        this.next("write");
        this.bar(m.disk.data.write / m.disk.max);

        this.next("read");
        this.bar(m.disk.data.read / m.disk.max);
    }
};

function DiskHistory(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
DiskHistory.prototype = {
    __proto__: History.prototype,

    name: "disk",

    draw: function(){
        let m = this.modules;
        this.begin(m.disk.history.write.length, 0, m.disk.max);

        this.next("write");
        this.line(m.disk.history.write, 0, 2);

        this.next("read");
        this.line(m.disk.history.read, 1, 2);
    }
};

function NetworkBar(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
NetworkBar.prototype = {
    __proto__: Bar.prototype,

    draw: function(){
        let m = this.modules;

        this.begin(2);

        this.next("up");
        this.bar(m.network.data.up / m.network.max);

        this.next("down");
        this.bar(m.network.data.down / m.network.max);
    }
};

function NetworkHistory(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
NetworkHistory.prototype = {
    __proto__: History.prototype,

    name: "network",

    draw: function(){
        let m = this.modules;
        this.begin(m.network.history.up.length, 0, m.network.max);

        this.next("up");
        this.line(m.network.history.up, 0, 2);

        this.next("down");
        this.line(m.network.history.down, 1, 2);
    }
};

function ThermalBar(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
ThermalBar.prototype = {
    __proto__: Bar.prototype,

    draw: function(){
        let m = this.modules;

        this.begin(1);

        this.next("thermal");
        this.bar((m.thermal.data[0] - m.thermal.min) / (m.thermal.max - m.thermal.min));
    }
};

function ThermalHistory(canvas, modules, time, settings, colors){
    this._init(canvas, modules, time, settings, colors);
}
ThermalHistory.prototype = {
    __proto__: History.prototype,

    name: "thermal",

    draw: function(){
        let m = this.modules;
        this.begin(m.thermal.history[0].length, 1, m.thermal.max, m.thermal.min);

        for(var i = 1, l = m.thermal.history.length; i < l; ++i){
            if(m.thermal.colorRef[i])
                this.next("cpu" + m.thermal.colorRef[i]);
            else {
                this.next("thermal");
                this.setAlpha((l - i / 4) / l);
            }
            this.line(m.thermal.history[i], i, l);
        }

        this.next("thermal");
        this.ctx.setDash([5, 5], 0);
        this.line(m.thermal.history[0], 0, l);
    }
};
