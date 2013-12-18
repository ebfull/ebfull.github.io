function InventoryTransition(type, name, obj) {
	this.id = name;
	this.name = name;
	this.type = type;
	this.obj = obj;
}

InventoryTransition.prototype = {
	validate: function(v) {
		v.applies.push(this)
	},
	apply: function(s) {
		s.do(this.id, this)
	}
}

InventoryTransition.prototype.__proto__ = ConsensusTransitionPrototype;

function Inventory(self) {
	self.inventory = this;
	this.inv = self.network.shared("inventory")
	this.inv.retain();

	this.polling = false;

	this.mySubscriptions = [];

	this.subscriptions = {};
	this.peerHas = {};
	this.tellPeer = {};
	this.mapAskFor = {};
	this.mapAlreadyAskedFor = {};

	this.invTick = function() {
		var doneSomething = false;

		for (var p in this.tellPeer) {
			var invPacket = this.tellPeer[p];

			if (Object.keys(invPacket) != 0) {
				doneSomething = true;
				self.peers.send(p, "inv", invPacket)

				this.tellPeer[p] = {}; // don't need to tell the peer that anymore
			}
		}

		// we may also need to ask our fellow peers for things
		if (Object.keys(this.mapAskFor).length != 0) {
			doneSomething = true; // we have to poll again

			var askMap = {};
			for (var p in this.peerHas) {
				askMap[p] = [];
			}

			nextObjectLoop:
			for (var name in this.mapAskFor) {
				if (this.mapAskFor[name] > self.now()) {
					// can't ask for this yet
					continue nextObjectLoop;
				}
				for (var p in this.peerHas) {
					if (typeof this.peerHas[p][name] != "undefined") {
						// let's ask this peer... maybe?
						if (typeof this.mapAlreadyAskedFor[p][name] == "undefined") {
							this.mapAlreadyAskedFor[p][name] = 0;
						}

						if (this.mapAlreadyAskedFor[p][name] < self.now()) {
							// great, ask this node
							askMap[p].push(name)

							this.mapAlreadyAskedFor[p][name] = self.now() + 2 * 60 * 1000; // don't ask this peer for another 2 minutes
							this.mapAskFor[name] = self.now() + 30 * 1000; // don't ask any peer for this for another 30 seconds

							continue nextObjectLoop;
						}
					}
				}
			}

			for (var p in askMap) {
				if (askMap[p].length == 0)
					continue;

				self.peers.send(p, "getdata", askMap[p])
			}
		}

		if (!doneSomething) {
			this.polling = false; // we don't need to poll again
			return false; // don't tick again
		}
	}

	this.addTick = function() {
		if (!this.polling) {
			this.polling = true;

			self.tick(1000, this.invTick, this)
		}
	}

	// do we have this object?
	this.getObj = function(name) {
		return this.inv.fetch(new FetchDo(name), name).result;
	}

	// add this object
	this.addObj = function(o) {
		var val = this.inv.validate(o)
		if (val.state == val.VALID) {
			this.inv = this.inv.shift(val)

			// we've added the object, but now we need to tell our peers we have it
			for (var p in this.tellPeer) {
				if (typeof this.subscriptions[p][o.type] != "undefined") {
					// just send the object
					self.peers.send(p, "invobj", o)
				} else {
					this.addTick()
					this.tellPeer[p][o.name] = o.type;
				}
			}
			return true;
		}

		return false;
	}

	// create a new inventory object from an existing object
	this.createObj = function(type, obj) {
		var o = new InventoryTransition(type, obj.name, obj)
		return this.addObj(o)
	}

	this.onInv = function(from, msg) {
		for (var name in msg) {
			// do we already have it? then we don't care
			if (this.getObj(name)) {
				// we already have it, so who cares
			} else {
				// start asking for it
				// and record who has it
				this.peerHas[from][name] = msg[name]

				if (typeof this.mapAskFor[name] == "undefined") {
					this.mapAskFor[name] = 0;
					this.addTick()
				}
			}
		}
	}

	this.onGetdata = function(from, msg) {
		msg.forEach(function(name) {
			if (o = this.getObj(name)) {
				self.peers.send(from, "invobj", o)
			}
		}, this)
	}

	this.onInvobj = function(from, o) {
		// add it
		if (this.addObj(o)) {
			// stop asking other peers for it (if we are)
			delete this.mapAskFor[o.name]

			for (var p in this.mapAlreadyAskedFor) {
				delete this.mapAlreadyAskedFor[p][o.name]
			}

			// we no longer care that our peers have this object
			for (var p in this.peerHas) {
				delete this.peerHas[p][o.name]
			}

			// now run a handler
			self.handle(from, "inv:" + o.type, o)
		}
	}

	this.subscribe = function(type) {
		this.mySubscriptions.push(type)
	}

	this.onSubscribe = function(from, type) {
		this.subscriptions[from][type] = true;
	}

	self.on("peermgr:connect", function(from) {
		this.subscriptions[from] = {};
		this.peerHas[from] = {};
		this.tellPeer[from] = {};
		this.mapAlreadyAskedFor[from] = {};

		this.mySubscriptions.forEach(function(sub) {
			self.peers.send(from, "subscribe", sub)
		}, this)
	}, this)

	self.on("peermgr:disconnect", function(from) {
		delete this.subscriptions[from]
		delete this.peerHas[from]
		delete this.tellPeer[from]
		delete this.mapAlreadyAskedFor[from]
	}, this)

	self.on("inv", this.onInv, this)
	self.on("getdata", this.onGetdata, this)
	self.on("invobj", this.onInvobj, this)
	self.on("subscribe", this.onSubscribe, this)

	this.addTick()
}