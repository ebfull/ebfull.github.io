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

var StateTransition = {
	id: 0x00,
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

	xor: function(b) {
		var a = this.id;
		var n = "";

		for (var i=0;i<a.length;i++) {
			n += String.fromCharCode(a.charCodeAt(i) ^ b.charCodeAt(i));
		}

		return n;
	},

	/*
		Apply this transition to the state object.
		Like setting unspent/spent outputs or storing metadata.

		THERE IS NO GUARANTEE OF ORDER OF APPLICATION, THAT SHOULD BE DONE BY VALIDATE
	*/
	apply: function(state) {

	},

	/*
		Can we apply the transition to this state (delta)?
	*/
	validate: function(state, validation) {
		if (!validation) {
			validation = new StateTransitionValidation(this)
			// store something, like how many inputs we still need
		}

		// validation.state should be changed if:
		//  1. we need no more inputs, or whatever, then VALID
		//  2. we still need inputs, so PARTIAL
		//  3. this transition occurs within the state already, so DUPLICATE
		//  4. this transition conflicts with a different transition, so CONFLICT
		//  5. this transition is invalid for some reason, so INVALID

		return validation;
	}
}

function ConsensusState(parent, transition) {
	if (transition)
		this.transitions = [transition]
	else
		this.transitions = []

	this.parent = parent;
	this.children = [];
	this._retain = 0;

	if (parent) {
		this.id = parent.id;
		parent.children.push(this)
		this.root = parent.root;
	} else {
		this.id = StateTransition.rand();
		this.root = this;
		this.shifts = {};
	}

	if (transition) {
		transition.apply(this)
		this.id = transition.xor(this.id)
	}
}

ConsensusState.prototype = {
	// returns a new state
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

				// new child means we retain
				n.retain();
			}

			// retain our new state
			n.retain();

			// release ourselves
			this.release();

			return n;
		}
		return false;
	},
	validate: function(transition) {
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
					return validation;
				break;
			}

			cur = cur.parent;
		}

		return validation;
	},
	retain: function() {
		this._retain++;
	},
	release: function() {
		this._retain--;

		if (this._retain == 0) {
			// We (may) serve as the parent for a number of child states in this.children
			// We should merge our state with all of our children

			// nothing will ever shift to this state
			delete this.root.shifts[this.id];

			this.children.forEach(function(child) {
				child.parent = this.parent;

				this.transitions.forEach(function(t) {
					t.apply(child) // apply parent transition to child state
				})
				child.transitions = this.transitions.concat(child.transitions)

				child.release();
			}, this)

			this.children = []
		}
	}
}







//////////////////////// INVENTORY STORAGE

function InventoryValidation(transition) {

}

InventoryValidation.prototype = new StateTransitionValidation();

function InventoryTransition(name, obj) {
	//this.name = name;
	//this.obj = obj;
	this.id = this.rand();

	this.apply = function(state) {
		if (typeof state.objs == "undefined") {
			state.objs = {};
		}

		state.objs[name] = obj;
	}

	this.validate = function(state, validation) {
		if (!validation) {
			validation = new InventoryValidation(this)
		}

		if (state.transitions.indexOf(this) != -1) {
			validation.state = validation.DUPLICATE;
		} else {
			validation.state = validation.VALID;
		}

		return validation;
	}
}

InventoryTransition.prototype = StateTransition;

var inv1 = new InventoryTransition("first", "test lol") // transaction 1
var inv2 = new InventoryTransition("second", "rofl lol") // transaction 2
var inv3 = new InventoryTransition("third", "POOP lol") // transaction 3

var root = new ConsensusState(false, false) // root state
var node1 = root;
var node2 = root; // same state
var node3 = root; // same state

node1.retain() // node 1 retains state
node2.retain() // node 2 retains state
node3.retain() // node 3 retains state

var val1 = node1.validate(inv1)
node1 = node1.shift(inv1, val1)

var val2 = node2.validate(inv2)
node2 = node2.shift(inv2, val2)

var val3 = node1.validate(inv2)
node1 = node1.shift(inv2, val3)

var val4 = node2.validate(inv1)
node2 = node2.shift(inv1, val4)

var val5 = node3.validate(inv2)
node3 = node3.shift(inv2, val5)

var val6 = node3.validate(inv3)
node3 = node3.shift(inv3, val6)

var val7 = node3.validate(inv1)
node3 = node3.shift(inv1, val7)

var val8 = node1.validate(inv3)
node1 = node1.shift(inv3, val8)

var val9 = node2.validate(inv3)
node2 = node2.shift(inv3, val9)

console.log(node1)
console.log(node2)
console.log(node3)
console.log("root: ")
console.log(root)