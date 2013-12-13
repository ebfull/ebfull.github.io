Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};

var latencySeed = Math.floor(Math.random() * 1000000000);

function latency(a, b) {
	var min = 10 + Math.abs(((a*latencySeed)^(b*latencySeed)) % 300);
	var avgVariance = 15;

	return Math.floor((Math.log(1-Math.random())/-1) * (avgVariance)) + min
}

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

	link_colormap:{},
	link_colormap_last:0,

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
		this.rehash(0);
	},

	setColor: function(p, color) {
		this.colormap_u = true;
		this.colormap[p] = color;
	},

	setLinkActivity: function(p, now) {
		this.link_colormap[p] = now;
		this.link_colormap_last = 0;
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
				.attr("y2", function(d) { return d.target.y; })
				.attr("id", function(d) {return "l-" + d.source.id + "-" + d.target.id;});

			svg.selectAll(".node").attr("cx", function(d) { return d.x; })
				.attr("cy", function(d) { return d.y; });
		}
	},

	rehash: function(now) {
		/***** COLORMAP *****/
		if (this.colormap_u) {
			for (var p in this.colormap) {
				$(".n" + p).css('fill', this.colormap[p]);
			}
			this.colormap_u = false;
		}

		if (this.link_colormap_last < (now-100)) {
			this.link_colormap_last = now;
			for (var p in this.link_colormap) {
				if (this.link_colormap[p] + 100 > now) {
					//console.log("setting #l-" + p + " to red")
					$("#l-" + p).css('stroke', "red")
				} else {
					//console.log("setting #l-" + p + " to black")
					$("#l-" + p).css('stroke', "#999")
					delete this.link_colormap[p];
				}
			}
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
	this.heapBuckets = {
		"default":new goog.structs.PriorityQueue(),
		"probs":new goog.structs.PriorityQueue()
	};
}

Events.prototype = {
	add: function(time, event, bucket) {
		if (typeof bucket == "undefined")
			bucket = "default"

		this.heapBuckets[bucket].insert(time, event);
	},

	next: function(maxtime) {
		var best = Number.POSITIVE_INFINITY;
		var best_bucket = false;

		for (var b in this.heapBuckets) {
			var time = this.heapBuckets[b].peekKey();

			if (typeof time == "undefined")
				continue; // bucket is empty

			if (time < best) {
				best = time;
				best_bucket = b;
			}
		}

		if (!best_bucket)
			return false;

		if (best > maxtime)
			return false;

		return {time:best, event:this.heapBuckets[best_bucket].dequeue()};
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

function NodeEvent(delay, nid, f, ctx) {
	if (typeof ctx == "undefined")
		ctx = network.nodes[nid]

	this.delay = delay;

	this.run = function(network) {
		f.call(ctx);
	}
}

function NodeMessageEvent(from, nid, name, obj) {
	this.delay = latency(from, nid);

	this.run = function(network) {
		network.setLinkActivity(from, nid)

		network.nodes[nid].handle(from, name, obj)
	}
}

function NodeTickEvent(delay, nid, f, ctx) {
	this.delay = delay;

	this.run = function(network) {
		var newDelay;
		if (newDelay = f.call(ctx) !== false) {
			if (typeof newDelay == "number")
				this.delay = newDelay;

			network.exec(this)
		}
	}
}

/****
@probability: used to describe probability of event firing every msec
@event: function called
@ctx: function context

NodeProbabilisticTickEvent.ignore is used to disable an event if it's
never going to occur again.
****/
function NodeProbabilisticTickEvent(probability, event, ctx) {
	// The event will occur in this.delay msec
	this.delay = Math.floor((Math.log(1-Math.random())/-1) * (1 / (probability)));
	this.ignore = false;

	this.run = function(network) {
		if (this.ignore)
			return false;

		// fire event
		event.call(ctx)

		// new delay
		this.delay = Math.floor((Math.log(1-Math.random())/-1) * (1 / (probability)));

		// create next event
		network.exec(this, "probs")
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
	prob: function(label, p, f, ctx) {
		this.network.pregister(label, p, this.id, f, ctx)
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

	log: function(msg) {
		return;
		if (this.id == 0)
			console.log(this.id + ": " + msg)
	},

	now: function() {
		return this.network.now;
	},

	tick: function(delay, f, ctx) {
		if (typeof ctx == "undefined")
			ctx = this;

		this.network.exec(new NodeTickEvent(delay, this.id, f, ctx))
	},

	send: function(nid, name, obj) {
		this.network.exec(new NodeMessageEvent(this.id, nid, name, obj))
	},

	handle: function(from, name, obj) {
		if (typeof this.handlers[name] != "undefined") {
			this.handlers[name](from, obj)
		}
	},

	on: function(name, f, ctx) {
		if (typeof ctx == "undefined")
			ctx = this;

		if (typeof this.handlers[name] != "undefined") {
			var oldHandler = this.handlers[name];
			this.handlers[name] = function(from, obj) {oldHandler.call(ctx, from, obj); f.call(ctx, from, obj);}
		} else {
			this.handlers[name] = function(from, obj) {return f.call(ctx, from, obj);};
		}
	},

	delay: function(delay, f, ctx) {
		this.network.exec(new NodeEvent(delay, this.id, f, ctx))
	}
}

function Node() {
	this._handlers = [];
	this._ticks = [];
	this._probs = [];
	this._use = [];
	this._init = false;
}

Node.prototype = {
	setup: function(node) {
		// run middleware
		for (var i=0;i<this._use.length;i++) {
			new this._use[i](node);
		}

		// run init functions
		if (this._init)
			this._init.call(node);

		// create tick events
		for (var i=0;i<this._ticks.length;i++) {
			node.tick(this._ticks[i].delay, this._ticks[i].f)
		}

		// create prob tick events
		for (var i=0;i<this._probs.length;i++) {
			node.prob(this._probs[i].label, this._probs[i].p, this._probs[i].f)
		}

		// create event handlers
		for (var i=0;i<this._handlers.length;i++) {
			node.on(this._handlers[i].name, this._handlers[i].f)
		}
	},

	use: function(f) {
		this._use.push(f);
	},

	init: function(callback) {
		if (!this._init)
			this._init = callback;
		else {
			var oldInit = this._init;
			this._init = function() {oldInit.call(this); callback.call(this)};
		}
	},

	on: function(event, callback) {
		this._handlers.push({name:event, f:callback})
	},

	tick: function(delay, callback) {
		this._ticks.push({delay: delay, f: callback})
	},

	prob: function(label, p, callback) {
		this._probs.push({label:label, p:p, f:callback})
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

	this._shared = {};
}

Network.prototype = {
	// grab a shared cache object
	shared: function(name) {
		if (typeof this._shared[name] == "undefined") {
			this._shared[name] = new ConsensusState(false, false);
		}

		return this._shared[name];
	},

	// registers probablistic event
	pregister: function(label, p, nid, cb, ctx) {
		if (typeof ctx == "undefined")
			ctx = this.nodes[nid]

		if (typeof this.pevents[nid + "-" + label] == "undefined") {
			this.pevents[nid + "-" + label] = new NodeProbabilisticTickEvent(p, cb, ctx)
			this.exec(this.pevents[nid + "-" + label], "probs")
		}
	},

	// deregisters a probablistic event
	depregister: function(label, nid) {
		if (typeof this.pevents[nid + "-" + label] != "undefined") {
			this.pevents[nid + "-" + label].ignore = true;
			delete this.pevents[nid + "-" + label];
		}
	},

	setColor: function(id, color) {
		if (typeof this.nodes[id] != "undefined")
		if (this.visualizer) {
			this.visualizer.setColor(this.nodes[id]._vid, color);
		}
	},

	setLinkActivity: function(from, to) {
		if (typeof this.nodes[to] != "undefined")
		if (typeof this.nodes[from] != "undefined")
		if (this.visualizer) {
			this.visualizer.setLinkActivity("n" + this.nodes[from]._vid + "-n" + this.nodes[to]._vid, this.now);
			this.visualizer.setLinkActivity("n" + this.nodes[to]._vid + "-n" + this.nodes[from]._vid, this.now);
		}
	},

	exec: function(e, bucket) {
		this.events.add(e.delay+this.now, e, bucket)
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
			this.visualizer.rehash(this.now);
		}
	}
}





/*
	This is instantiated to store the validator state as the state deltas are traversed.
*/
function StateTransitionValidation() {
	this.state = 2;
}

StateTransitionValidation.prototype = {
	VALID: 1, // State transition is completely valid here.
	PARTIAL: 2, // State transition is not yet fully valid.
	CONFLICT: 3, // State transition conflicts with another transition here.
	INVALID: 4, // State transition is otherwise invalid.
	DUPLICATE: 5, // State transition already occurred here.
}

/*
	Prototype transition for a ConsensusState.
*/
var StateTransition = {
	id: 0x00,

	// generate some random bytes
	rand: function() {
		return String.fromCharCode(
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256)
			)
	},

	// xor bytes (commutative operation to compare states regardless of order of transitions)
	xor: function(b) {
		var a = this.id;
		var n = "";

		for (var i=0;i<a.length;i++) {
			n += String.fromCharCode(a.charCodeAt(i) ^ b.charCodeAt(i));
		}

		return n;
	},

	// Applies this transition to the state.
	//  1. Create any state vars we don't have.
	//  2. If an 'untransition' exists in this state, delete the untransition and its effects.
	//  3. Otherwise, apply the transition and push the transition to the state.
	// NOTE: Transitions must be orderless.
	apply: function(state) {

	},

	// Unapplies a transaction from the state.
	// This is only called by the unshifter, so it's in charge of modifying the id of the ultimate state.
	//  1. Don't unapply the same transaction twice on this state.
	//  2. Create any state vars we need.
	//  3. Apply the untransition and push the untransition to the state.
	// NOTE: Once again, orderless.
	unapply: function(state) {

	},

	// Validator, used to confirm the legitimacy of a transition at a particular state.
	// 1. Validator should keep track of untransitions, so it can ignore duplicate transitions it comes across.
	// 2. Should account for the effects of an 'unapply' to the state.
	// 3. Identify duplicate transitions
	// 4. Identify conflicts
	// 5. Stay PARTIAL until we've reached a good state, become VALID
	validate: function(state, validation) {
		if (!validation) {
			validation = new StateTransitionValidation(this)
		}

		return validation;
	},

	// Invalidator, used to identify 'untransitions' necessary to perform during unshifting.
	// 1. Stay PARTIAL until we identify this transition, then become VALID
	// 2. If we reach any states dependent on this transition, we should run the invalidator recursively on
	//    the base state and merge the untransitions.
	invalidate: function(state, validation) {
		if (!validation) {
			validation = new StateTransitionValidation(this)
		}

		return validation;
	}
}

/*
	ConsensusState object.

	Node should retain this once they adopt it.
*/
function ConsensusState(parent, transition) {
	this.transitions = []

	this.untransitions = [];
	this.parent = parent;
	this.children = [];
	this.branch = {};
	this.shiftcache = {}; // cached validations for transitions FOR THIS STATE
	this.unshiftcache = {}; // cached validations for untransitions FOR THIS STATE
	this._retain = 0;

	if (parent) {
		this.id = parent.id;
		parent.children.push(this)
		this.root = parent.root;
	} else {
		this.id = StateTransition.rand();
		this.root = this;
		this.shifts = {};
		this.unshifts = {};
	}

	if (transition) {
		transition.apply(this)
		this.id = transition.xor(this.id)
	}
}

ConsensusState.prototype = {
	// returns a new state, automatically retains and releases
	shift: function(transition, validation) {
		if (validation.state == validation.VALID) {
			// check the base object for cached transitions
			var n;

			if (this.root.shifts[transition.xor(this.id)]) {
				n = this.root.shifts[transition.xor(this.id)];
			} else {
				n = new ConsensusState(this, transition)

				// we need to cache this transition
				this.root.shifts[transition.xor(this.id)] = n;

				// new child means we retain, we don't need to run up the chain though
				n._retain++;
			}

			// retain our new state
			n.retain();

			// release ourselves
			this.release();

			return n;
		}
		return false;
	},
	// returns a new state, automatically retains and releases
	unshift: function(transition, validation) {
		if (validation.state == validation.VALID) {
			var n;

			// check the base object for cached untransitions
			if (this.root.unshifts[transition.xor(this.id)]) {
				n = this.root.unshifts[transition.xor(this.id)]
			} else {
				n = new ConsensusState(this, false);
				// unapply all of validation's transitions

				validation.untransitions.forEach(function(tr) {
					tr.unapply(n)
				}, this)

				this.root.unshifts[transition.xor(this.id)] = n

				n._retain++; // new child means retain, we don't need to run up the chain though
			}

			// retain our new state
			n.retain();

			// release ourselves
			this.release();

			return n;
		}

		return false;
	},
	fetch: function(collection) {
		var cur = this;

		while (cur) {
			if (!collection.handle(cur))
				break;

			cur = cur.parent;
		}

		return collection;
	},
	// used to validate a transition
	validate: function(transition) {
		if (typeof this.shiftcache[transition.id] != "undefined") {
			return this.shiftcache[transition.id];
		}

		var cur = this;

		var validation = false; // store our validation state

		while (cur) {
			validation = transition.validate(cur, validation);

			switch (validation.state) {
				case validation.PARTIAL:
					// do nothing, continue up the chain
				break;
				case validation.VALID:
				case validation.CONFLICT:
				case validation.INVALID:
				case validation.DUPLICATE:
					this.shiftcache[transition.id] = validation;
					return validation;
				break;
			}

			cur = cur.parent;
		}

		this.shiftcache[transition.id] = validation;

		return validation;
	},
	// used to invalidate a transition
	invalidate: function(transition) {
		if (typeof this.unshiftcache[transition.id] != "undefined") {
			return this.unshiftcache[transition.id];
		}

		var cur = this;

		var validation = false;

		while(cur) {
			validation = transition.invalidate(cur, validation)

			switch(validation.state) {
				case validation.PARTIAL:
					// do nothing, continue up the chain
				break;
				case validation.VALID:
				case validation.CONFLICT:
				case validation.INVALID:
				case validation.DUPLICATE:
					this.unshiftcache[transition.id] = validation;
					return validation;
				break;
			}

			cur = cur.parent;
		}

		this.unshiftcache[transition.id] = validation;

		return validation;
	},
	lock: function(child) {
		if (this._retain == 0)
			return false;

		var i = this.children.indexOf(child)

		if (typeof this.branch[i] == "undefined") {
			this.branch[i] = 0;
		}

		this.branch[i]++;
	},
	unlock: function(child) {
		if (this._retain == 0)
			return false;

		var i = this.children.indexOf(child)

		if (typeof this.branch[i] == "undefined") {
			this.branch[i] = 0;
		}

		this.branch[i]--;
	},
	retain: function() {
		this._retain++;

		if (this.parent)
			this.parent.lock(this);
	},
	release: function() {
		this._retain--;

		if (this._retain == 0) {
			// our parent must have released us

			// 1. nothing will ever shift to this state
			delete this.root.shifts[this.id];

			for (var s in this.root.unshifts) {
				if (this.root.unshifts[s] == this)
					delete this.root.unshifts[s]
			}

			// 2. we should consider merging with our parent if we can (as many times as possible)

			while (this.parent) {
				if ((this.parent.transitions.length) <= (this.transitions.length)) {
					// we have at least as many transitions, so let's merge.

					// first, keep a record of our transitions/untransitions
					var ourTransitions = this.transitions;
					var ourUntransitions = this.untransitions;
					var ourId = this.id;

					// second, clear ourselves
					for (var prop in this) {
						switch (prop) {
							case "branch":
							case "unshifts":
							case "shifts":
							case "shiftcache":
							case "unshiftcache":
							case "children":
							case "root":
							case "id":
							case "parent":
							case "_retain":
							break;
							case "transitions":
							this.transitions = []
							break;
							case "untransitions":
							this.untransitions = []
							break;
							default:
								delete this[prop]
							break;
						}
					}

					// now, run our parent's transitions and untransitions on ourself
					this.parent.transitions.forEach(function(t) {
						t.apply(this)
					}, this)

					this.parent.untransitions.forEach(function(t) {
						t.unapply(this)
					}, this)

					// now, run our recorded transitions/untransitions on ourself
					ourTransitions.forEach(function(t) {
						t.apply(this)
					}, this)

					ourUntransitions.forEach(function(t) {
						t.unapply(this)
					}, this)

					// restore the id if it was changed by an unapply
					this.id = ourId;

					// our parent is now our parent's parent
					this.parent = this.parent.parent;
				} else {
					break;
				}
			}

			// lastly, release our children

			this.children.forEach(function(child, i) {
				// ignore children in defunct branches
				if (this.branch[i]) {
					child.release();
				}
				else
					console.log("ignoring defunct branch")

			}, this)

			// don't store children anymore
			this.children = []
		} else {
			if (this.parent)
				this.parent.unlock();
		}
	}
}