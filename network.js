function revchart(r, h) {
	var res = "<table><tr><td>node</td><td>revenue</td></tr>";
	// sort r
	var n = [];
	for (var id in r) {
		n.push({id:id,rev:r[id]})
	}
	n.sort(function(a,b) {
		if (a.rev == b.rev) return 0;

		return a.rev > b.rev ? -1 : 1;
	})
	for (var i=0;i<n.length;i++) {
		res += "<tr><td>" + n[i].id + "</td><td>" + n[i].rev + " (" + ((n[i].rev/h)*100).toFixed(2) + "%)<br /></td></tr>";
	}
	return res + "</table>";
}

function Visualizer(div) {
	this.divname = div;
}

Visualizer.prototype = {
	width: 1000,
	height: 500,
	linkDistance: 30,
	charge: -100,
	gravity: .5,
	nindex: 0, // the cursor of the nodes array

	svg: null,
	force: null,
	nodes: null,
	links: null,
	slink: null,
	snode: null,
	edges: {},
	inodes: [],
	updated:false,

	colormap:{},
	colormap_u:false,

	init: function() {
		// init the network layout/svg
		$(this.divname).css('width', this.width);
		$(this.divname).css('height', this.height);

		this.force = d3.layout.force()
			.size([this.width,this.height])
			.nodes([]) // no nodes
			.linkDistance(this.linkDistance)
			.charge(this.charge)
			.gravity(this.gravity);

		this.svg = d3.select(this.divname).append("svg")
	    	.attr("width", this.width)
	    	.attr("height", this.height);

	   	this.svg.append("rect")
		    .attr("width", this.width)
		    .attr("height", this.height);

		this.nodes = this.force.nodes();
		this.links = this.force.links();
		this.slink = this.svg.selectAll(".link");
		this.snode = this.svg.selectAll(".node");

		this.force = this.force.on("tick", this.tick());

		this.updated = true;
		this.rehash();
	},

	setColor: function(p, color) {
		this.colormap_u = true;
		this.colormap[p] = color;
	},

	getRandomLink: function() {
		var result;
		var count=1;
		for (var prop in this.edges) {
			if (Math.random() < 1/++count)
				result = prop;
		}
		if (!result)
			return -1;
		var e = result.split("-");
		return [parseInt(e[0]), parseInt(e[1])];
	},

	getRandomNode: function() {
		return this.inodes[Math.floor(Math.random()*this.inodes.length)];
	},

	getKeyForID: function(id) {
		return this.inodes.indexOf(id);
	},

	incCharge: function(amt) {
		this.force.charge(this.force.charge() - amt);
		this.updated = true;
		///////////this.rehash();
	},

	addNode: function() {
		// add a node, return the index
		this.nodes.push({id:"n"+this.nindex});
		this.inodes.push(this.nindex);
		this.updated = true;
		/////////////this.rehash();

		this.nindex++;
		return this.nindex-1;
	},

	connect: function(a, b) {
		if (this.edges.hasOwnProperty(a + '-' + b) || this.edges.hasOwnProperty(b + '-' + a))
			return false; // we're already connected

		if (a==b)
			return false; // can't connect to ourself silly!

		//console.log('CONNECTING EDGES ' + a + ' AND ' + b);
		this.edges[a + '-' + b] = {source:this.nodes[this.getKeyForID(a)],target:this.nodes[this.getKeyForID(b)]};
		this.links.push(this.edges[a + '-' + b]);

		this.updated = true;
		//////this.rehash();
	},

	disconnect: function(a, b) {
		if (!this.edges.hasOwnProperty(a + '-' + b) && !this.edges.hasOwnProperty(b + '-' + a))
			return false; // we're already disconnected

		var i = this.links.indexOf(this.edges[a + '-' + b]);
		if (i<0)
			i = this.links.indexOf(this.edges[b + '-' + a]);

		delete this.edges[a + '-' + b];
		delete this.edges[b + '-' + a];

		this.links.splice(i, 1); // remove the link

		this.updated = true;
		//////this.rehash();
	},

	removeNode: function(index) {
		// remove a node at index
		var i = this.getKeyForID(index);
		if (i < 0)
			return false; // this one has already been removed

		this.nodes.splice(i, 1);
		this.inodes.splice(i, 1);
		this.updated = true;
		///////////////////this.rehash();
	},

	tick: function() {
		var svg = this.svg;
		return function() {
			svg.selectAll(".link").attr("x1", function(d) { return d.source.x; })
				.attr("y1", function(d) { return d.source.y; })
				.attr("x2", function(d) { return d.target.x; })
				.attr("y2", function(d) { return d.target.y; });

			svg.selectAll(".node").attr("cx", function(d) { return d.x; })
				.attr("cy", function(d) { return d.y; });
		}
	},

	rehash: function() {
		/***** COLORMAP *****/
		if (this.colormap_u) {
			for (var p in this.colormap) {
				$(".n" + p).css('fill', this.colormap[p]);
			}
			this.colormap_u = false;
		}

		if (!this.updated)
			return;

		this.slink = this.slink.data(this.force.links(), function(d) { return d.source.id + "-" + d.target.id; });
		this.slink.enter().insert("line", ".node")
			.attr("class", "link");
		this.slink.exit().remove();

		this.snode = this.snode.data(this.force.nodes(), function(d) {return d.id;});
		this.snode.enter().append("circle").attr("class", function (d) {return "node " + d.id;})
			.attr("r", 3)
			.call(this.force.drag);
		this.snode.exit().remove();

		this.force.start();

		this.updated = false;
	}
};

/*
	Events

	This object is used to coordinate events that occur in the simulation. It is a proxy
	for a priority queue.
*/
function Events() {
	this.heap = new goog.structs.PriorityQueue();
}

Events.prototype = {
	add: function(time, event) {
		this.heap.insert(time, event);
	},

	next: function(maxtime) {
		var time = this.heap.peekKey();

		if (typeof time == "undefined")
			return false;

		if (time > maxtime)
			return false;

		return {time:time, event:this.heap.dequeue()};
	}
}

/*
	Interface:
		run(network) - runs an event against the Network
		delay - msec delay before the event should occur once it is committed to the network

	NodeEvent: runs a function against a node's state
	NodeMessageEvent: triggers a handler against a node's state, follows middleware paths
	NodeTickEvent: a repetitive function ran against a node's state.
		- if the function returns false, we do not run the tick again
		- the return of this function can override the delay if it is a number
	NodeProbabilisticTickEvent: a pool of events that can occur at any time, like mining
*/

function NodeEvent(delay, nid, f) {
	this.delay = delay;

	this.run = function(network) {
		f(network.nodes[nid]);
	}
}

function NodeMessageEvent(from, nid, name, obj) {
	// TODO: make this deterministic
	this.delay = Math.floor(Math.random() * 400) + 50;

	this.run = function(network) {
		network.nodes[nid].handle(from, name, obj)
	}
}

function NodeTickEvent(delay, nid, f) {
	this.delay = delay;

	this.run = function(network) {
		var newDelay;
		if (newDelay = f(network.nodes[nid]) !== false) {
			if (typeof newDelay == "number")
				this.delay = newDelay;

			network.exec(this)
		}
	}
}

function NodeProbabilisticTickEvent(delay) {
	this.delay = delay;
	this.events = {}
	this.pnothing = 1;
	this.ptotal = 0;
	this.numevents = 0;
}

NodeProbabilisticTickEvent.prototype = {
	register: function(p, nid, f) {
		// p is the probability of the event firing at the given moment
		if (p <= 0)
			return false;

		this.events[nid] = {p:p, f:f}; // store the event
		this.pnothing *= 1-p; // the probability of nothing happening decreases
		this.ptotal += p; // the probability of an event occuring increases
		this.numevents++; // the number of events we handle increases
	},

	deregister: function(nid) {
		if (typeof this.events[nid] != "undefined") {
			this.pnothing /= 1-(this.events[nid].p);
			this.ptotal -= this.events[nid].p;
			delete this.events[nid];
			this.numevents--;
		}
	},

	runevent: function(network) {
		var which = Math.random() * this.ptotal;

		var cur = 0;
		for (var nid in this.events) {
			cur += this.events[nid].p;

			if (which <= cur) {
				this.events[nid].f(network.nodes[nid])
				break;
			}
		}
	},

	run: function(network) {
		var ecount = 0;

		while (Math.random() > this.pnothing) {
			ecount++;
		}

		while (ecount > 0) {
			// which event should occur?
			this.runevent(network)
			ecount--;
		}

		if (this.numevents) {
			network.exec(this); // register ourselves again! we still have events that could occur again
		}
	}
}

/*
	NodeState

	Has a bunch of helper functions for the node.
*/

function NodeState(node, network, id) {
	this.id = id;
	this.network = network;
	this.handlers = [];

	node.setup(this);
}

NodeState.prototype = {
	prob: function(label, delay, p, f) {
		this.network.pregister(label, delay, p, this.id, f)
	},

	deprob: function(label) {
		this.network.depregister(label, this.id)
	},

	setColor: function(color) {
		this.network.setColor(this.id, color);
	},

	connect: function(remoteid) {
		this.network.connect(this.id, remoteid);
	},

	disconnect: function(remoteid) {
		this.network.disconnect(this.id, remoteid);
	},

	now: function() {
		return this.network.now;
	},

	tick: function(delay, f) {
		this.network.exec(new NodeTickEvent(delay, this.id, f))
	},

	send: function(nid, name, obj) {
		this.network.exec(new NodeMessageEvent(this.id, nid, name, obj))
	},

	handle: function(from, name, obj) {
		if (typeof this.handlers[name] != "undefined") {
			this.handlers[name](this, from, obj)
		}
	},

	on: function(name, f) {
		if (typeof this.handlers[name] != "undefined") {
			var oldHandler = this.handlers[name];
			this.handlers[name] = function(self, from, obj) {if (oldHandler(self, from, obj)) f(self, from, obj);}
		} else {
			this.handlers[name] = f;
		}
	},

	delay: function(delay, f) {
		this.network.exec(new NodeEvent(delay, this.id, f))
	}
}

function Node() {
	this._handlers = [];
	this._ticks = [];
	this._probs = [];
	this._init = false;
}

Node.prototype = {
	setup: function(node) {
		// run init functions
		if (this._init)
			this._init(node);

		// create tick events
		for (var i=0;i<this._ticks.length;i++) {
			node.tick(this._ticks[i].delay, this._ticks[i].f)
		}

		// create prob tick events
		for (var i=0;i<this._probs.length;i++) {
			node.prob(this._probs[i].label, this._probs[i].delay, this._probs[i].p, this._probs[i].f)
		}

		// create event handlers
		for (var i=0;i<this._handlers.length;i++) {
			node.on(this._handlers[i].name, this._handlers[i].f)
		}
	},

	use: function(f) {
		// runs f against the Node object for attaching middleware
		f(this);
	},

	init: function(callback) {
		if (!this._init)
			this._init = callback;
		else {
			var oldInit = this._init;
			this._init = function(self) {oldInit(self); callback(init)};
		}
	},

	on: function(event, callback) {
		this._handlers.push({name:event, f:callback})
	},

	tick: function(delay, callback) {
		this._ticks.push({delay: delay, f: callback})
	},

	prob: function(label, delay, p, callback) {
		this._probs.push({label:label, delay:delay, p:p, f:callback})
	}
}

/*
	Network
*/

function Network(visualizerDiv) {
	this.events = new Events(); // normal events
	this.pevents = {}; // probablistic event buckets
	if (typeof visualizerDiv != "undefined") {
		$(visualizerDiv).html("");
		this.visualizer = new Visualizer(visualizerDiv);
		this.visualizer.init();
	} else {
		this.visualizer = false;
	}
	this.now = 0;

	this.nodes = [];
	this.nindex = 0;
}

Network.prototype = {
	// registers probablistic event
	pregister: function(label, delay, p, nid, cb) {
		if (typeof this.pevents[label] == "undefined") {
			this.pevents[label] = new NodeProbabilisticTickEvent(delay)
			this.exec(this.pevents[label])
		}
		
		this.pevents[label].register(p, nid, cb)
	},

	// deregisters a probablistic event
	depregister: function(label, nid) {
		if (typeof this.pevents[label] != "undefined") {
			this.pevents[label].deregister(nid)
		}
	},

	setColor: function(id, color) {
		if (this.visualizer) {
			this.visualizer.setColor(this.nodes[id]._vid, color);
		}
	},

	exec: function(e) {
		this.events.add(e.delay+this.now, e)
	},

	connect: function (a, b) {
		if (this.visualizer) {
			this.visualizer.connect(this.nodes[a]._vid, this.nodes[b]._vid);
		}
	},

	disconnect: function (a, b) {
		if (this.visualizer) {
			this.visualizer.disconnect(this.nodes[a]._vid, this.nodes[b]._vid);
		}
	},

	add: function(amt, node) {
		for (;amt>0;amt--) {
			var state = new NodeState(node, this, this.nindex);
			if (this.visualizer)
				state._vid = this.visualizer.addNode();

			this.nodes[this.nindex] = state;
			this.nindex++;
		}
	},

	// run buffer time worth of tasks
	run: function(buffer) {
		var max = this.now+buffer;
		var e = false;
		while (e = this.events.next(max)) {
			this.now = e.time;
			e.event.run(this)
		}

		this.now += buffer;

		if (this.visualizer) {
			this.visualizer.rehash();
		}
	}
}