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
			state.objs[this.name] = this.obj;

			state.transitions.unshift(this)
		}
	},

	unapply: function(state) {
		if (state.untransitions.indexOf(this) != -1)
			return; // don't unapply twice (happens in complex reorgs)

		this.init(state)

		state.ignoreobjs[this.name] = this.obj;

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
	}
}

function Inventory(self) {
	self.inventory = this;
	this.inv = self.network.shared("inventory")
	this.inv.retain();

	this.peerHas = {};

	// do we have this object?
	this.getObj = function(name) {
		return this.inv.fetch(new FetchObject(name)).result;
	}

	// add this object
	this.addObj = function(type, name, data) {
		var obj = new InventoryTransition(type, name, data)

		var val = this.inv.validate(obj)
		if (val.state == val.VALID) {
			this.inv = this.inv.shift(obj, val)
			return true;
		}

		return false;
	}

	self.on("peermgr:connect", function(from) {
		this.peerHas[from] = {};
	}, this)

	self.on("peermgr:disconnect", function(from) {
		delete this.peerHas[from]
	}, this)
}