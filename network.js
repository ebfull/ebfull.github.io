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
					$("#l-" + p).css('stroke', "black")
				} else {
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
/*
		// let's update this.force to adjust the graph linkDistance
		var smallestY = Number.POSITIVE_INFINITY;
		var largestY = Number.NEGATIVE_INFINITY;
		$(".node").each(function() {
			var thisY = $(this).attr("cy")
			if (thisY < smallestY)
				smallestY = thisY;

			if (thisY > largestY)
				largestY = thisY;
		})

		if (smallestY != Number.POSITIVE_INFINITY) {
			if (smallestY > (.2 * this.height)) {
				this.charge *= 1.01;
				this.force = this.force.charge(this.charge)

				//this.updated = true;
				return
			} else if (smallestY < (.1 * this.height)) {
				this.charge *= 0.99;
				this.force = this.force.charge(this.charge)

				//this.updated = true;
				return
			}
		} 

		if (largestY != Number.POSITIVE_INFINITY) {
			if (largestY < (.8 * this.height)) {
				this.charge *= 0.99;
				this.force = this.force.charge(this.charge)

				//this.updated = true;
			} else if (largestY > (.9 * this.height)) {
				this.charge *= 1.01;
				this.force = this.force.charge(this.charge)

				//this.updated = true;
			}
		}
*/
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
	this.delay = delay;

	this.run = function(network) {
		if (typeof ctx == "undefined")
			ctx = network.nodes[nid]

		f.call(ctx);
	}
}

function NodeMessageEvent(from, nid, name, obj) {
	this.delay = latency(from, nid);

	this.run = function(network) {
		//network.setLinkActivity(from, nid)

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
function NodeProbabilisticTickEvent(probability, event, nid, ctx) {
	// The event will occur in this.delay msec
	this.delay = Math.floor((Math.log(1-Math.random())/-1) * (1 / (probability)));
	this.ignore = false;

	this.run = function(network) {
		if (this.ignore)
			return false;

		if (typeof ctx == "undefined")
			ctx = network.nodes[nid]

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
			console.log("[" + this.now() + "]: " + this.id + ": " + msg)
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
		if (typeof this.pevents[nid + "-" + label] == "undefined") {
			this.pevents[nid + "-" + label] = new NodeProbabilisticTickEvent(p, cb, nid, ctx)
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





function ConsensusState(parent) {
	if (parent) {
		this.id = parent.id;
		this.root = parent.root;
		this._retain = 1;
		parent.children.push(this)
	} else {
		this.id = this.rand();
		this.root = this;
		this._retain = 0;

		this.statecache = {};
	}
	this.parent = parent; // our parent state
	this.children = []; // states that build on top of us, we must release these

	this.transitions = []; // stuff we applied to this state
	this.untransitions = []; // stuff we unapplied to this state

	this.buckets = {}; // transitions are placed into buckets to comb less of them during validation

	this.validatorCache = {}; // map transitions id to validator
	this.invalidatorCache = {}; // map transition id to validator

	this.fetchCache = {}; // cache of fetch() result objects
}

ConsensusState.prototype = {
	inherit: function() {
		for (var key in this.parent.buckets) {
			this.parent.buckets[key].forEach(function(tr) {
				if (this.untransitions.indexOf(tr) == -1) {
					if (!(key in this.buckets)) {
						this.buckets[key] = []
					}
					this.buckets[key].push(tr)
				}
			}, this)
		}

		this.parent.transitions.forEach(function(parentTr) {
			var un = this.untransitions.indexOf(parentTr);

			if (un != -1) {
				this.untransitions.splice(un, 1)
			} else {
				this.transitions.push(parentTr)
			}
		}, this)

		this.parent.untransitions.forEach(function(parentUntr) {
			this.untransitions.push(parentUntr)
		}, this)

		this.parent = this.parent.parent;
	},
	retain: function() {
		this._retain++;
	},
	release: function() {
		this._retain--;

		if (this._retain == 0) {
			// nothing will shift to this state anymore
			delete this.root.statecache[this.id]

			// merge upward as much as possible
			while(this.parent && this.parent._retain == 0) {
				// TODO: improve metric
				if ((this.parent.transitions.length + this.parent.untransitions.length) <= (this.transitions.length + this.untransitions.length)) {
					this.inherit();
				} else {
					break;
				}
			}

			// release our children
			this.children.forEach(function(child) {
				child.release();
			}, this)

			// garbage collect defunct branches
			this.children = [];

			// garbage collect other stuff
			this.fetchCache = {};
			this.validatorCache = {};
			this.invalidatorCache = {};
		}
	},
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
	xor: function(a, b) {
		var n = "";

		for (var i=0;i<a.length;i++) {
			n += String.fromCharCode(a.charCodeAt(i) ^ b.charCodeAt(i));
		}

		return n;
	},
	attach: function(bucket, transition) {
		if (!(bucket in this.buckets)) {
			this.buckets[bucket] = []
		}

		this.buckets[bucket].unshift(transition)
	},
	unattach: function(bucket, transition) {
		if (bucket in this.buckets) {
			var i = this.buckets[bucket].indexOf(transition)

			if (i != -1) {
				this.buckets[bucket].splice(i, 1)

				if (this.buckets[bucket].length == 0) {
					delete this.buckets[bucket]
				}
			}
		}
	},
	// Verify that the transition can be constructed on top of this state.
	validate: function(transition) {
		if (transition.id in this.validatorCache) {
			return this.validatorCache[transition.id]
		} else {
			this.validatorCache[transition.id] = new ConsensusValidator(transition);
			transition.validate(this.validatorCache[transition.id])
			this.validatorCache[transition.id].validate(this)

			return this.validatorCache[transition.id];
		}
	},
	// Invalidate the transition, and anything that may depend on it
	invalidate: function(transition) {
		if (transition.id in this.invalidatorCache) {
			return this.invalidatorCache[transition.id]
		} else {
			this.invalidatorCache[transition.id] = new ConsensusValidator(transition);
			transition.invalidate(this.invalidatorCache[transition.id])
			this.invalidatorCache[transition.id].validate(this)

			return this.invalidatorCache[transition.id];
		}
	},
	// Create a new ConsensusState, release the old one, return the new one.
	shift: function(validator) {
		if (validator.state != validator.VALID)
			return false;

		var newid = this.id;

		validator.applies.forEach(function(transition) {
			newid = this.xor(newid, transition.id)
		}, this)

		validator.unapplies.forEach(function(transition) {
			newid = this.xor(newid, transition.id)
		}, this)

		if (newid in this.root.statecache) {
			var n = this.root.statecache[newid];

			n.retain();
			this.release();
			return n;
		}

		var n = new ConsensusState(this);

		this.root.statecache[newid] = n;

		validator.applies.forEach(function(transition) {
			transition.apply(n)
			n.transitions.push(transition)
		}, this)

		validator.unapplies.forEach(function(transition) {
			//transition.unapply(n) // TODO? ??
			n.untransitions.push(transition)
		}, this)

		n.id = newid;
		n.retain(); // retain new state
		this.release(); // release old state

		return n;
	},
	fetch: function(f, key) {
		if (typeof key != "undefined") {
			if (key in this.fetchCache) {
				return this.fetchCache[key]
			} else {
				this.fetchCache[key] = f;
			}
		}

		var cur = this;

		while (cur) {
			if (f.handle(cur)) {
				return f;
			}

			cur = cur.parent;
		}

		if (typeof f.finalize != "undefined")
			f.finalize();

		return f;
	}
}



function ConsensusValidator(transition) {
	this.state = this.PARTIAL;
	this.conflict = false;

	this.applies = []; // (for shift) a list of transitions we should apply
	this.unapplies = []; // (for shift) a list of transitions we should unapply

	this.closed = true; // is the checklist closed
	this.checklist = []; // checklist which we should satisfy
}

ConsensusValidator.prototype = {
	VALID: 0,
	PARTIAL: 1,
	CONFLICT: 2,
	INVALID: 3,
	DUPLICATE: 4,

	// Asserts that a named event virtually occurred.
	check: function(bucket, f) {
		this.checklist.push({bucket:bucket,f:f})
		this.closed = false;
	},
	// Process this validation for the given state
	validate: function(state) {
		this.closed = true;
		while(true) {
			var ignore = [];

			var cur = state;

			while (cur) {
				this.applies.forEach(function(tr) {
					if (cur.transitions.indexOf(tr) != -1) {
						if (ignore.indexOf(tr) == -1)
							this.state = this.DUPLICATE;
					}
				}, this)

				if (this.state != this.PARTIAL)
					return;

				var removeFromChecklist = [];

				this.checklist.forEach(function(check, indexCheck) {
					if (check.bucket in cur.buckets) {
						var iter = cur.buckets[check.bucket]

						for (var i=0;i<iter.length;i++) {
							var transition = iter[i]

							if (ignore.indexOf(transition) == -1) {
								if (check.f(transition, this, check.bucket)) {
									// callback returned true, thus we can remove this checklist item
									removeFromChecklist.push(indexCheck)
									return;
								}
							}
						}
					}
				}, this)

				var d = 0;
				removeFromChecklist.forEach(function(ci) {
					this.checklist.splice(ci-d, 1)
					d++;
				}, this)

				// start ignoring anything this state claims never occurred
				cur.untransitions.forEach(function(ignoreThis) {
					ignore.push(ignoreThis)
				})

				if (this.state != this.PARTIAL)
					return;

				if (!this.closed) {
					this.closed = true;
					continue;
				}

				cur = cur.parent;
			}

			break;
		}

		var removeFromChecklist = [];

		// final pass through checklist:
		this.checklist.forEach(function(check, indexCheck) {
			if (check.f(false, this, check.bucket)) {
				removeFromChecklist.push(indexCheck)
			}
		}, this)

		var d = 0;
		removeFromChecklist.forEach(function(ci) {
			this.checklist.splice(ci-d, 1)
			d++;
		}, this)

		if (this.state == this.PARTIAL) {
			if (this.checklist.length == 0) {
				this.state = this.VALID;
			}
		}
	}
}


var ConsensusTransitionPrototype = {
	// traverse all parent states, presumably to catch duplicate transitions
	persist: function(tr, v) {
		if (!tr)
			return true;

		return false;
	}
}


// Templates for Generic Structures

var ConsensusMapObject = {
	apply: function(s) {
		if (typeof this.bucket != "undefined")
			s.attach(this.bucket, this)
		else
			s.attach(this.id, this)
	},
	validate: function(v) {
		if (v.applies.indexOf(this) != -1)
			return;

		v.applies.push(this)

		if (typeof this.bucket != "undefined")
			v.check(this.bucket, this.persist)
		else
			v.check(this.id, this.persist)
	},
	invalidate: function(v) {
		if (v.unapplies.indexOf(this) != -1)
			return;

		v.unapplies.push(this)
	}
}

ConsensusMapObject.__proto__ = ConsensusTransitionPrototype;


function FetchEntry(name) {
	this.result = false;
	this.ignoreTr = [];

	this.handle = function(state) {
		state.untransitions.forEach(function(untr) {
			this.ignoreTr.push(untr)
		}, this)

		if (name in state.buckets) {
			if (state.buckets[name].some(function(tr) {
				var ind;
				if ((ind = this.ignoreTr.indexOf(tr)) != -1) {
					this.ignoreTr.splice(ind, 1)
				} else {
					this.result = tr;
					return true;
				}

				return false;
			}, this))
				return true;
		}

		return false;
	}
}


function FetchEntries(name, getid) {
	this.result = [];
	this.ignoreTr = [];

	this.handle = function(state) {
		state.untransitions.forEach(function(untr) {
			this.ignoreTr.push(untr)
		}, this)

		if (name in state.buckets) {
			state.buckets[name].forEach(function(tr) {
				var ind;
				if ((ind = this.ignoreTr.indexOf(tr)) != -1) {
					this.ignoreTr.splice(ind, 1)
				} else {
					this.result.push(tr);
				}
			}, this)
		}

		return false;
	}

	this.finalize = function() {
		if (typeof getid == "undefined")
			return;

		var found = false;

		this.result.some(function(res) {
			if (res.id == getid) {
				this.result = res;
				found = true;
				return true;
			}
			return false;
		}, this)

		if (!found)
			this.result = false;
	}
}