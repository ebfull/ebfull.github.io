function InventoryTransition(type, name, obj) {
	this.id = this.rand();
	this.name = name;
	this.type = type;
	this.obj = obj;
}

InventoryTransition.prototype = {
	init: function(state) {
		if (typeof state.objs == "undefined") {
			state.objs = {};
			state.ignoreobjs = {};
		}
	},

	apply: function(state) {
		this.init(state)

		if (state.untransitions.indexOf(this) != -1) {
			state.untransitions.splice(state.untransitions.indexOf(this), 1)

			delete state.ignoreobjs[this.name]
		} else {
			state.objs[this.name] = this;

			state.transitions.unshift(this)
		}
	},

	unapply: function(state) {
		if (state.untransitions.indexOf(this) != -1)
			return; // don't unapply twice (happens in complex reorgs)

		this.init(state)

		state.ignoreobjs[this.name] = true;

		state.id = this.xor(state.id)

		state.untransitions.unshift(this)
	},

	validate: function(state, validation) {
		if (!validation) {
			validation = new StateTransitionValidation(this)
			validation.ignoreObjs = {};
			validation.untransitions = [];
		}

		validation.untransitions = validation.untransitions.concat(state.untransitions);

		for (var i in state.ignoreobjs) {
			validation.ignoreObjs[i] = state.ignoreobjs[i];
		}

		if (state.transitions.indexOf(this) != -1) {
			if (validation.untransitions.indexOf(this) != -1) {
				// remove untransition
				validation.untransitions.splice(validation.untransitions.indexOf(this), 1)
			} else {
				validation.state = validation.DUPLICATE;

				return validation;
			}
		} else {
			if (typeof validation.ignoreObjs[this.name] != "undefined") {
				delete validation.ignoreObjs[this.name]
			} else {
				
			}
		}

		if (state.parent == false) {
			if (validation.state == validation.PARTIAL) {
				validation.state = validation.VALID;
			}
		}

		return validation;
	},

	invalidate: function(state, validation) {
		if (!validation) {
			validation = new StateTransitionValidation(this)
			validation.untransitions = [this];
		}

		if (state.untransitions.indexOf(this) != -1) {
			validation.state = validation.DUPLICATE;
		} else {
			if (state.transitions.indexOf(this) != 1) {
				validation.state = validation.VALID;
			} else {
				// otherwise, remain PARTIAL
			}
		}

		return validation;
	}
}

InventoryTransition.prototype.__proto__ = StateTransition;

function FetchObject(name) {
	this.ignore = false;
	this.name = name;
	this.result = false;
}

FetchObject.prototype = {
	handle: function(state) {
		InventoryTransition.prototype.init(state)

		if (typeof state.ignoreobjs[this.name] != "undefined")
			this.ignore = true;

		if (typeof state.objs[this.name] != "undefined") {
			// we found it, but do we need to ignore
			if (this.ignore) {
				this.ignore = false;
			} else {
				this.result = state.objs[this.name]
				return false;
			}
		}

		return true;
	}
}

// TODO: No 'relay set', arbitrary transaction index is exposed to all nodes.

function Inventory(self) {
	self.inventory = this;
	this.inv = self.network.shared("inventory")
	this.inv.retain();

	this.polling = false;

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
		return this.inv.fetch(new FetchObject(name)).result;
	}

	// add this object
	this.addObj = function(o) {
		var val = this.inv.validate(o)
		if (val.state == val.VALID) {
			this.inv = this.inv.shift(o, val)

			// we've added the object, but now we need to tell our peers we have it
			for (var p in this.tellPeer) {
				this.addTick()
				this.tellPeer[p][o.name] = o.type;
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

		// stop asking other peers for it (if we are)
		delete this.mapAskFor[o.name]

		for (var p in this.mapAlreadyAskedFor) {
			delete this.mapAlreadyAskedFor[p][o.name]
		}

		// add it
		this.addObj(o)

		// tell all our peers that we have it
		for (var p in this.tellPeer) {
			this.tellPeer[p][o.name] = o.type;

			// we no longer care if they have it
			delete this.peerHas[p][o.name]
		}

		// now run a handler
		self.handle(from, "inv:" + o.type, o)
	}

	this.addTick()

	self.on("peermgr:connect", function(from) {
		this.peerHas[from] = {};
		this.tellPeer[from] = {};
		this.mapAlreadyAskedFor[from] = {};
	}, this)

	self.on("peermgr:disconnect", function(from) {
		delete this.peerHas[from]
		delete this.tellPeer[from]
		delete this.mapAlreadyAskedFor[from]
	}, this)

	self.on("inv", this.onInv, this)
	self.on("getdata", this.onGetdata, this)
	self.on("invobj", this.onInvobj, this)
}