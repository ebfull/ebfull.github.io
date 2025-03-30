/*
	btc-inventory

	Mimics the Bitcoin inventory system.
*/

function InventoryObject(type, obj) {
	this.type = type;
	this.obj = obj;
	this.id = obj.id;
}

function InventoryState(status) {
	this.status = status;

	this.equals = function(v) {
		return this.status == v.status;
	}
}

InventoryObject.prototype = {
	init: function(consensus) {
		consensus.add(this.id, this);
	},

	seen: function(me) {
		var ir = me.get(this.id);

		if (ir.status == "none") {
			me.set(this.id, new InventoryState("seen"))

			return true;
		}

		return false;
	},

	relay: function(me) {
		var ir = me.get(this.id);

		if (ir.status == "seen") {
			me.set(this.id, new InventoryState("relay"))

			return true;
		}

		return false;
	}
}

function Inventory(self) {
	self.inventory = this;

	this.polling = false;

	this.objects = self.network.shared("inventory");

	this.peerHas = {};
	this.tellPeer = {};
	this.mapAskFor = {};
	this.mapAlreadyAskedFor = {};

	this.addTick = function() {
		if (!this.polling) {
			this.polling = true;

			self.tick(1000, this.invTick, this)
		}
	}

	this.invTick = function() {
		var doneSomething = false;

		for (var p in this.tellPeer) {
			var invPacket = this.tellPeer[p];

			if (Object.keys(invPacket) != 0) {
				doneSomething = true;
				this.__send_inv(p, invPacket)

				this.tellPeer[p] = {}; // don't need to tell the peer that anymore
			}
		}

		var askMap = {};
		for (var p in this.peerHas) {
			askMap[p] = [];
		}

		for (var p in this.mapAskFor) {
			for (name in this.mapAskFor[p]) {
				if (this.mapAskFor[p][name] <= self.now()) {
					askMap[p].push(name);
					delete this.mapAskFor[p][name]
				}
			}
		}

		for (var p in askMap) {
			if (askMap[p].length == 0)
				continue;

			doneSomething = true;

			this.__send_getdata(p, askMap[p])
		}

		if (!doneSomething) {
			this.polling = false; // we don't need to poll again
			return false; // don't tick again
		}
	}

	/*
		p, {name1: type1, name2: type2, ...}
	*/
	this.__send_inv = function(p, mapNameTypes) {
		self.peermgr.send(p, "inv", mapNameTypes);
	}

	/*
		p, [name1, name2, name3]
	*/
	this.__send_getdata = function(p, askList) {
		self.peermgr.send(p, "getdata", askList);
	}

	/*
		p, (InventoryObject) o
	*/
	this.__send_invobj = function(p, o) {
		self.peermgr.send(p, "invobj", o);
	}

	this.relay = function(name, now) {
		var ir = this.objects.get(name);

		if ('relay' in ir) {
			if (ir.relay(this.objects)) {
				for (var p in this.tellPeer) {
					if (now) {
						this.__send_invobj(p, ir);
					} else {
						this.addTick();
						this.tellPeer[p][name] = ir.type;
					}
				}
			}
		}
	}

	this.getObj = function(name, mustRelay) {
		var ir = this.objects.get(name);

		if (ir.status == "none")
			return false;

		if (mustRelay && ir.status == "seen")
			return false;

		return ir.__proto__;
	}

	this.onGetdata = function(from, msg) {
		msg.forEach(function(name) {
			if (o = this.getObj(name, true)) {
				this.__send_invobj(from, o);
			}
		}, this)
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

				if (!(name in this.mapAlreadyAskedFor)) {
					this.mapAlreadyAskedFor[name] = self.now();
				} else {
					this.mapAlreadyAskedFor[name] += 2 * 60 * 1000;
				}
				this.mapAskFor[from][name] = this.mapAlreadyAskedFor[name];
				this.addTick()
			}
		}
	}

	this.onInvobj = function(from, o) {
		// add it
		if (this.addObj(o)) {
			// stop asking other peers for it (if we are)
			delete this.mapAlreadyAskedFor[o.id]

			for (var p in this.mapAskFor) {
				delete this.mapAskFor[p][o.id]
			}

			// we no longer care that our peers have this object
			for (var p in this.peerHas) {
				delete this.peerHas[p][o.id]
			}

			// now run a handler
			self.handle(from, "obj:" + o.type, o.obj)
		}
	}

	this.addObj = function(obj) {
		return obj.seen(this.objects);
	}

	// obj must have `name` property
	this.createObj = function(type, obj) {
		var o = new InventoryObject(type, obj);

		this.objects.create(o);
		this.addObj(o);

		return o;
	}

	self.on("peermgr:connect", function(from) {
		this.peerHas[from] = {};
		this.tellPeer[from] = {};
		this.mapAskFor[from] = {};

		// todo: send full inventory
	}, this)

	self.on("peermgr:disconnect", function(from) {
		delete this.peerHas[from]
		delete this.tellPeer[from]
		delete this.mapAlreadyAskedFor[from]
	}, this)

	self.on("inv", this.onInv, this)
	self.on("getdata", this.onGetdata, this)
	self.on("invobj", this.onInvobj, this)
	this.addTick();
}

module.exports = Inventory;